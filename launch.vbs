Set WshShell = CreateObject("WScript.Shell")
projectDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = projectDir
WshShell.Run """" & projectDir & "\node_modules\.bin\electron.cmd"" """ & projectDir & """", 0, False
