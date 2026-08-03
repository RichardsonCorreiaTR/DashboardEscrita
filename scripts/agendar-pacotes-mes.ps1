# Agendar exportacao mensal de pacotes Minhas Metas (Windows Task Scheduler)
# Executar como Administrador OU criar tarefa manualmente com estes parametros.
#
# Uso: powershell -ExecutionPolicy Bypass -File scripts/agendar-pacotes-mes.ps1

$Projeto = "C:\1 - A\B\Programas\DashboardEscrita"
$Node = "C:\Program Files\nodejs\node.exe"
$Script = Join-Path $Projeto "scripts\exportar-pacotes-mes.js"
$NomeTarefa = "DashboardEscrita-PacotesAnalista-Mensal"

$Acao = New-ScheduledTaskAction -Execute $Node -Argument "`"$Script`" --refresh --auto" -WorkingDirectory $Projeto
$Gatilho = New-ScheduledTaskTrigger -Monthly -DaysOfMonth 1 -At "09:00"
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName $NomeTarefa -Action $Acao -Trigger $Gatilho -Settings $Settings `
  -Description "Exporta pacotes Minhas Metas individuais para cada analista (1o dia do mes, 9h)"

Write-Host "Tarefa agendada: $NomeTarefa"
Write-Host "Comando manual: cd `"$Projeto`" ; npm run exportar-pacotes-mes"
