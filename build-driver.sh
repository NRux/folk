#!/usr/bin/env bash
# Folkly autonomous build driver.
# Runs the staged build prompts (docs/TODOs/stage-NN-*.md) sequentially with the Codex CLI.
#
# Usage: build-driver.sh [start-stage]     # default: 1
#
# - Logs each stage's console output to docs/TODOs/build-logs/stage-NN-*.log (gitignored).
# - Stops on a nonzero Codex exit code or when a stage's status file says BLOCKED.
# - Resume from a later stage with: build-driver.sh <N>
#
# Each stage prompt itself enforces: status file + BUILD-STATE.md update + git commit.

set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TODO_DIR="$REPO_ROOT/docs/TODOs"
LOG_DIR="$TODO_DIR/build-logs"
mkdir -p "$LOG_DIR"

STAGES=(
  "stage-01-inspect-preserve"
  "stage-02-platform-migration"
  "stage-03-personas-rendering"
  "stage-04-research-pipeline"
  "stage-05-admin-control-room"
  "stage-06-scheduler-publication"
  "stage-07-acceptance-verify"
  "stage-08-activate-ops-delivery"
)

START="${1:-1}"
if [[ "$START" =~ ^[0-9]+$ ]] && (( START >= 1 && START <= ${#STAGES[@]} )); then
  IDX=$(( START - 1 ))
else
  echo "usage: build-driver.sh [start-stage 1..${#STAGES[@]}]" >&2
  exit 2
fi

# Preflight: must be in a git repo on master, with a clean tree (stages commit themselves).
cd "$REPO_ROOT" || exit 2
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "ERROR: not a git repo" >&2; exit 2; }
BRANCH="$(git branch --show-current)"
echo "[driver] repo: $REPO_ROOT (branch: $BRANCH)"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "[driver] WARNING: working tree is dirty; a stage may commit unrelated changes."
  echo "[driver] Aborting. Commit or stash first, then re-run."
  exit 2
fi

command -v codex >/dev/null 2>&1 || { echo "ERROR: codex CLI not found on PATH" >&2; exit 2; }

for (( i = IDX; i < ${#STAGES[@]}; i++ )); do
  STAGE="${STAGES[$i]}"
  PROMPT="$TODO_DIR/$STAGE.md"
  STATUS_FILE="$LOG_DIR/$STAGE.status"
  LOG_FILE="$LOG_DIR/$STAGE.log"

  if [[ ! -f "$PROMPT" ]]; then
    echo "[driver] ABORT: prompt missing: $PROMPT" >&2
    exit 2
  fi

  echo "==================================================================="
  echo "[driver] $(date -u +%Y-%m-%dT%H:%M:%SZ) starting $STAGE"
  echo "==================================================================="

  # Fresh checkout state for the stage (best effort; never lose commits).
  git pull --ff-only origin master >/dev/null 2>&1 || true

  if codex exec --sandbox workspace-write --cd "$REPO_ROOT" "$(cat "$PROMPT")" 2>&1 | tee "$LOG_FILE"; then
    :
  else
    echo "[driver] $STAGE: codex exited nonzero (see $LOG_FILE)" >&2
    break
  fi

  if [[ -f "$STATUS_FILE" ]]; then
    STATUS_LINE="$(head -n1 "$STATUS_FILE")"
    echo "[driver] $STAGE status: $STATUS_LINE"
    case "$STATUS_LINE" in
      DONE)
        echo "[driver] $STAGE DONE."
        ;;
      BLOCKED*)
        echo "[driver] $STAGE is BLOCKED: $STATUS_LINE" >&2
        echo "[driver] Stopping the chain. Fix the blocker, then re-run: build-driver.sh $(( i + 1 ))" >&2
        exit 1
        ;;
      *)
        echo "[driver] $STAGE status unrecognized: '$STATUS_LINE' — treating as failure." >&2
        exit 1
        ;;
    esac
  else
    echo "[driver] $STAGE: no status file written (expected $STATUS_FILE). Treating as failure." >&2
    exit 1
  fi

  # Safety: if the stage did not commit, record and stop rather than continuing on uncommitted work.
  if [[ -n "$(git status --porcelain)" ]]; then
    echo "[driver] $STAGE: working tree is dirty after the stage (expected a commit)." >&2
    git status --short >&2
    echo "[driver] Stopping so the uncommitted work can be inspected." >&2
    exit 1
  fi
done

echo "[driver] All stages completed."
