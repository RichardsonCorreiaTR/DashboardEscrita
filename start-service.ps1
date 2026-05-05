# Dashboard Diretrizes - Servico em Background com auto-recuperacao
# Garante que o servidor web (porta 4000) rode continuamente.
# Roda oculto, sem janela, e reinicia automaticamente se o processo morrer.
#
# Instalado no Startup do Windows para iniciar automaticamente ao ligar o PC.

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$pidFile = Join-Path $scriptDir "logs\service.pid"
$logFile = Join-Path $scriptDir "logs\service.log"
$nodePath = "C:\Program Files\nodejs\node.exe"
$appPath = Join-Path $scriptDir "src\servidor\app.js"

# Garante que a pasta de logs existe
$logsDir = Join-Path $scriptDir "logs"
if (-not (Test-Path $logsDir)) { New-Item -ItemType Directory -Path $logsDir -Force | Out-Null }

function Write-Log($msg) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$ts] $msg"
    Add-Content -Path $logFile -Value $line -Encoding UTF8
}

# Verifica se a porta 4000 esta em uso (servidor ja rodando)
function Get-RunningDashboard {
    $conn = Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue
    if ($conn) { return $conn.OwningProcess }
    return $null
}

# Mata processo existente na porta 4000
function Stop-ExistingDashboard {
    $existingPid = Get-RunningDashboard
    if ($existingPid) {
        Write-Log "Matando processo existente na porta 4000 (PID: $existingPid)"
        Stop-Process -Id $existingPid -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }
}

# Inicia o servidor Node.js com logs de stdout/stderr
function Start-Dashboard {
    Stop-ExistingDashboard
    Write-Log "Iniciando Dashboard Diretrizes na porta 4000..."

    $nodeLog = Join-Path $logsDir "node-output.log"
    $nodeErr = Join-Path $logsDir "node-error.log"

    $process = Start-Process -FilePath $nodePath `
        -ArgumentList "`"$appPath`"" `
        -WorkingDirectory $scriptDir `
        -WindowStyle Hidden `
        -RedirectStandardOutput $nodeLog `
        -RedirectStandardError $nodeErr `
        -PassThru

    $process.Id | Out-File -FilePath $pidFile -Encoding UTF8 -Force
    Write-Log "Servidor iniciado com PID: $($process.Id)"
    return $process
}

# === MAIN: Loop de supervisao ===
Write-Log "=== Servico Dashboard Diretrizes iniciado ==="

# Verificar se ja tem outro supervisor rodando (evitar duplicata)
$meuPid = $PID
$outroSupervisor = Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object {
    $_.CommandLine -like '*Dashboard Diretrizes*start-service*' -and $_.ProcessId -ne $meuPid
}
if ($outroSupervisor) {
    Write-Log "Ja existe outro supervisor rodando (PID: $($outroSupervisor.ProcessId)). Encerrando duplicata."
    exit 0
}

# Iniciar servidor (se nao estiver rodando)
$existingPid = Get-RunningDashboard
if ($existingPid) {
    Write-Log "Servidor ja esta rodando na porta 4000 (PID: $existingPid). Mantendo."
} else {
    $webProcess = Start-Dashboard
}

# Loop de supervisao: verifica a cada 60 segundos
while ($true) {
    Start-Sleep -Seconds 60

    $runningPid = Get-RunningDashboard
    if (-not $runningPid) {
        Write-Log "ALERTA: Dashboard caiu! Reiniciando..."
        $webProcess = Start-Dashboard
        Write-Log "Dashboard reiniciado."
    }
}
