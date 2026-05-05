' Dashboard Diretrizes - Launcher oculto (nenhuma janela visivel)
' Executa o start-service.ps1 como processo background invisivel.
' Este e o arquivo chamado pelo atalho do Startup do Windows.

Set objShell = CreateObject("WScript.Shell")
strCommand = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & _
    Replace(WScript.ScriptFullName, "start-hidden.vbs", "start-service.ps1") & """"
objShell.Run strCommand, 0, False
