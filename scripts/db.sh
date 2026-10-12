#!/bin/bash
# Sportmetryx Football — local PostgreSQL control script.
# Uses the embedded PostgreSQL binaries in .tools/package (no root required).
# The package ships only initdb, pg_ctl and postgres — all schema work is done
# through Prisma, which connects over TCP like any normal client.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PG_HOME="$REPO_ROOT/.tools/package"
PG_BIN="$PG_HOME/native/bin"
PG_LIB="$PG_HOME/native/lib"
PG_DATA="$REPO_ROOT/.pgdata"
PG_LOG="$REPO_ROOT/.pgdata.log"
PG_PORT="${PG_PORT:-5432}"
PG_SUPERUSER="${PG_SUPERUSER:-postgres}"

export LD_LIBRARY_PATH="$PG_LIB${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"

initdb_bin="$PG_BIN/initdb"
pg_ctl_bin="$PG_BIN/pg_ctl"

ensure_symlinks() {
  # The npm tarball strips symlinks; the package ships a hydrator for them.
  if [ -f "$PG_HOME/native/pg-symlinks.json" ]; then
    (cd "$PG_HOME" && node scripts/hydrate-symlinks.js >/dev/null 2>&1 || true)
  fi
}

port_open() {
  (exec 3<>"/dev/tcp/127.0.0.1/$PG_PORT") >/dev/null 2>&1
}

wait_for_port() {
  local tries=0
  until port_open; do
    tries=$((tries + 1))
    if [ "$tries" -ge 60 ]; then
      echo "PostgreSQL did not open port $PG_PORT within 60s." >&2
      echo "--- last log lines ---" >&2
      tail -n 40 "$PG_LOG" >&2 || true
      return 1
    fi
    sleep 1
  done
}

do_init() {
  ensure_symlinks
  if [ -f "$PG_DATA/PG_VERSION" ]; then
    echo "Data directory already initialized at .pgdata — skipping initdb."
    return 0
  fi
  echo "Running initdb (superuser: $PG_SUPERUSER, trust auth, C locale)..."
  "$initdb_bin" -D "$PG_DATA" \
    --username="$PG_SUPERUSER" \
    --auth=trust \
    --encoding=UTF8 \
    --no-locale

  cat >> "$PG_DATA/postgresql.conf" <<CONF

# --- Sportmetryx local dev overrides ---
listen_addresses = '127.0.0.1'
port = $PG_PORT
# fsync stays ON: the sandbox may SIGTERM the server between shell calls,
# so crash-safe recovery matters more than insert speed here.
CONF
  echo "initdb complete."
}

do_start() {
  ensure_symlinks
  if [ ! -f "$PG_DATA/PG_VERSION" ]; then
    echo "No data directory found — run 'scripts/db.sh init' first." >&2
    return 1
  fi
  if port_open; then
    echo "PostgreSQL already running on port $PG_PORT."
    return 0
  fi
  # Every sandboxed shell call runs in a fresh PID namespace, so a
  # postmaster.pid left behind by a SIGTERM'd server can alias a live
  # unrelated PID (e.g. PID 2 = the sandbox shell) and block startup.
  # The port probe above is the source of truth; a stale pid file is safe to drop.
  rm -f "$PG_DATA/postmaster.pid"
  echo "Starting PostgreSQL on 127.0.0.1:$PG_PORT ..."
  "$pg_ctl_bin" -D "$PG_DATA" -l "$PG_LOG" -w -t 30 start
  wait_for_port
  echo "PostgreSQL is up."
}

do_run() {
  # Run postgres in the FOREGROUND. Use this under a process supervisor
  # (e.g. a managed background job) so the server outlives the calling shell.
  ensure_symlinks
  if [ ! -f "$PG_DATA/PG_VERSION" ]; then
    echo "No data directory found — run 'scripts/db.sh init' first." >&2
    return 1
  fi
  echo "postgres (foreground) starting on 127.0.0.1:$PG_PORT ..."
  exec "$PG_HOME/native/bin/postgres" -D "$PG_DATA"
}

do_stop() {
  if "$pg_ctl_bin" -D "$PG_DATA" -m fast stop >/dev/null 2>&1; then
    echo "PostgreSQL stopped."
  else
    rm -f "$PG_DATA/postmaster.pid"
    echo "PostgreSQL not running (stale pid cleared)."
  fi
}

do_status() {
  if port_open; then
    echo "PostgreSQL: RUNNING on port $PG_PORT"
  else
    echo "PostgreSQL: STOPPED"
  fi
}

do_reset() {
  echo "Resetting local PostgreSQL (drops ALL local data)..."
  "$pg_ctl_bin" -D "$PG_DATA" -m fast stop >/dev/null 2>&1 || true
  rm -rf "$PG_DATA" "$PG_LOG"
  do_init
  do_start
}

case "${1:-}" in
  init)  do_init ;;
  start) do_start ;;
  run)   do_run ;;
  stop)  do_stop ;;
  status) do_status ;;
  reset) do_reset ;;
  *)
    echo "Usage: scripts/db.sh {init|start|run|stop|status|reset}"
    echo "Env overrides: PG_PORT (default 5432), PG_SUPERUSER (default postgres)"
    exit 1
    ;;
esac
