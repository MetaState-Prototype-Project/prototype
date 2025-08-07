#!/bin/bash

set -euo pipefail

echo "[INFO] Getting NodePort services..."
NODEPORTS=$(kubectl get svc --all-namespaces \
    -o jsonpath='{range .items[?(@.spec.type=="NodePort")]}{.metadata.namespace}{" "}{.metadata.name}{" "}{.spec.ports[*].nodePort}{"\n"}{end}')

if [[ -z "$NODEPORTS" ]]; then
    echo "[INFO] No NodePort services found."
    exit 0
fi

echo ""
echo "[INFO] Found NodePort services:"
echo "$NODEPORTS"
echo ""

echo "$NODEPORTS" | while IFS= read -r line; do
    [[ -z "$line" ]] && continue

    NAMESPACE=$(echo "$line" | awk '{print $1}')
    NAME=$(echo "$line" | awk '{print $2}')
    PORTS=$(echo "$line" | cut -d' ' -f3-)

    echo "────────────────────────────────────────────"
    echo "[SERVICE] $NAMESPACE/$NAME (NodePort(s): $PORTS)"

    for PORT in $PORTS; do
        echo "[INFO] Starting tunnel for $NAME (NodePort: $PORT)..."

        # Launch minikube tunnel in background and capture output
        TMPFILE=$(mktemp)
        (minikube service "$NAME" -n "$NAMESPACE" --url >"$TMPFILE") &
        TUNNEL_PID=$!

        echo "[INFO] Waiting for tunnel to start..."
        i=0
        while ! grep -q "http://" "$TMPFILE"; do
            sleep 0.2
            i=$((i + 1))
            if [[ $i -gt 50 ]]; then
                echo "  [ERROR] Timed out waiting for tunnel to start"
                kill $TUNNEL_PID >/dev/null 2>&1 || true
                rm -f "$TMPFILE"
                continue 2
            fi
        done

        RAW_URL=$(cat "$TMPFILE")
        TUNNELED_PORT=$(echo "$RAW_URL" | sed -E 's|.*:([0-9]+)$|\1|')

        echo "[DEBUG] RAW_URL = '$RAW_URL'"
        echo "[INFO] Minikube is forwarding to: $RAW_URL"
        echo "[INFO] We will bind localhost:$PORT → localhost:$TUNNELED_PORT"

        if lsof -iTCP:$PORT >/dev/null 2>&1; then
            echo "  [SKIP] Port $PORT already in use locally"
        else
            echo "[INFO] Launching socat..."
            nohup socat TCP4-LISTEN:$PORT,fork,reuseaddr TCP4:127.0.0.1:$TUNNELED_PORT \
                >/tmp/socat-tunnel-$PORT.log 2>&1 &

            SOCAT_PID=$!
            echo "[OK] socat launched with PID $SOCAT_PID"
            echo "[INFO] Log file: /tmp/socat-tunnel-$PORT.log"
        fi

        rm -f "$TMPFILE"
        echo "[INFO] Leaving Minikube tunnel running in background (PID: $TUNNEL_PID)"
    done
done

echo ""
echo "[DONE] All NodePorts are now mapped to localhost properly."
