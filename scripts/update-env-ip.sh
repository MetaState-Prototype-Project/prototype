#!/usr/bin/env bash
#
# Updates local network IPs in .env files with the current machine's local IP
# Supports: 192.168.x.x, 10.x.x.x, 172.16-31.x.x (RFC 1918 private ranges)
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Get the current local network IP
get_local_ip() {
    local ip=""
    
    # Try ip command first (modern Linux)
    if command -v ip &> /dev/null; then
        ip=$(ip route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") print $(i+1)}' | head -1)
    fi
    
    # Fallback to hostname -I (Linux)
    if [[ -z "$ip" ]] && command -v hostname &> /dev/null; then
        ip=$(hostname -I 2>/dev/null | awk '{print $1}')
    fi
    
    # Fallback to ifconfig (macOS / older systems)
    if [[ -z "$ip" ]] && command -v ifconfig &> /dev/null; then
        ip=$(ifconfig 2>/dev/null | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -Eo '([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | head -1)
    fi
    
    echo "$ip"
}

# Display file with bat or cat
display_file() {
    local file="$1"
    local label="${2:-}"
    
    if [[ -n "$label" ]]; then
        echo -e "${CYAN}─── $label ───${NC}"
    fi
    
    if command -v bat &> /dev/null; then
        bat --paging=never --style=numbers,grid --language=bash "$file"
    else
        cat -n "$file"
    fi
}

# Regex pattern to match private IPs
PRIVATE_IP_PATTERN='(10\.[0-9]+\.[0-9]+\.[0-9]+|172\.(1[6-9]|2[0-9]|3[0-1])\.[0-9]+\.[0-9]+|192\.168\.[0-9]+\.[0-9]+)'

# Ask for confirmation
confirm() {
    local prompt="${1:-Continue?}"
    local response
    
    echo -en "${YELLOW}${prompt} [y/N]: ${NC}"
    read -r response
    
    case "$response" in
        [yY][eE][sS]|[yY])
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

update_env_file() {
    local env_file="$1"
    local new_ip="$2"
    local skip_confirm="${3:-false}"
    
    if [[ ! -f "$env_file" ]]; then
        echo -e "${RED}Error: File not found: $env_file${NC}" >&2
        return 1
    fi
    
    # Find all unique local IPs in the file
    local found_ips
    found_ips=$(grep -oE "$PRIVATE_IP_PATTERN" "$env_file" 2>/dev/null | sort -u || true)
    
    if [[ -z "$found_ips" ]]; then
        echo -e "${YELLOW}No local network IPs found in $env_file${NC}"
        return 0
    fi
    
    echo -e "${GREEN}Found local IPs in $env_file:${NC}"
    echo "$found_ips" | while read -r ip; do
        local count
        count=$(grep -c "$ip" "$env_file" || true)
        echo "  - $ip ($count occurrence(s))"
    done
    echo ""
    
    # Generate preview
    local tmp_file
    tmp_file=$(mktemp)
    
    sed -E "s/$PRIVATE_IP_PATTERN/$new_ip/g" "$env_file" > "$tmp_file"
    
    echo -e "${CYAN}Preview of changes (IPs will be replaced with ${GREEN}$new_ip${CYAN}):${NC}"
    echo ""
    display_file "$tmp_file" "$env_file"
    echo ""
    
    # Ask for confirmation unless skipped
    if [[ "$skip_confirm" != "true" ]]; then
        if ! confirm "Apply these changes to $env_file?"; then
            echo -e "${YELLOW}Skipped: $env_file${NC}"
            rm -f "$tmp_file"
            return 0
        fi
    fi
    
    # Apply changes
    mv "$tmp_file" "$env_file"
    echo -e "${GREEN}Updated: $env_file${NC}"
}

print_usage() {
    cat << EOF
Usage: $(basename "$0") [OPTIONS] [ENV_FILE...]

Updates local network IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x) in .env files
with the current machine's local network IP address.

Shows a preview of changes and asks for confirmation before modifying files.

OPTIONS:
    -h, --help          Show this help message
    -y, --yes           Skip confirmation prompts (auto-confirm all)
    -i, --ip IP         Use specified IP instead of auto-detecting
    -a, --all           Update all .env files in the project (recursive)

EXAMPLES:
    $(basename "$0")                    # Update .env in project root
    $(basename "$0") -y                 # Update without confirmation
    $(basename "$0") path/to/.env       # Update specific .env file
    $(basename "$0") -i 192.168.1.100   # Use specific IP
    $(basename "$0") -a                 # Update all .env files in project

EOF
}

main() {
    local skip_confirm=false
    local custom_ip=""
    local update_all=false
    local env_files=()
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -h|--help)
                print_usage
                exit 0
                ;;
            -y|--yes)
                skip_confirm=true
                shift
                ;;
            -i|--ip)
                custom_ip="$2"
                shift 2
                ;;
            -a|--all)
                update_all=true
                shift
                ;;
            -*)
                echo -e "${RED}Unknown option: $1${NC}" >&2
                print_usage
                exit 1
                ;;
            *)
                env_files+=("$1")
                shift
                ;;
        esac
    done
    
    # Determine the IP to use
    local new_ip
    if [[ -n "$custom_ip" ]]; then
        new_ip="$custom_ip"
    else
        new_ip=$(get_local_ip)
    fi
    
    if [[ -z "$new_ip" ]]; then
        echo -e "${RED}Error: Could not determine local IP address${NC}" >&2
        echo "Try specifying an IP with: $(basename "$0") -i YOUR_IP" >&2
        exit 1
    fi
    
    echo -e "${GREEN}Current local IP: $new_ip${NC}"
    echo ""
    
    # Determine which files to update
    if [[ "$update_all" == "true" ]]; then
        # Find all .env files (excluding .env.example and node_modules)
        while IFS= read -r -d '' file; do
            env_files+=("$file")
        done < <(find "$PROJECT_ROOT" -name ".env" -not -path "*/node_modules/*" -print0 2>/dev/null)
    elif [[ ${#env_files[@]} -eq 0 ]]; then
        # Default to project root .env
        env_files=("$PROJECT_ROOT/.env")
    fi
    
    if [[ ${#env_files[@]} -eq 0 ]]; then
        echo -e "${YELLOW}No .env files found to update${NC}"
        exit 0
    fi
    
    # Update each file
    for env_file in "${env_files[@]}"; do
        echo -e "${GREEN}Processing: $env_file${NC}"
        echo ""
        update_env_file "$env_file" "$new_ip" "$skip_confirm"
        echo ""
    done
    
    echo -e "${GREEN}Done!${NC}"
}

main "$@"
