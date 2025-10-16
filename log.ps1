 
$files = @(
 'C:\home\LogFiles\W3SVC1669251875\fr000489.xml',
 'C:\home\LogFiles\W3SVC1669251875\fr000490.xml',
 'C:\home\LogFiles\W3SVC1669251875\fr000491.xml',
 'C:\home\LogFiles\W3SVC1669251875\fr000481.xml'
)
foreach ($p in $files) {
  $x = [xml](Get-Content $p)
  $ns = @{ ev='http://schemas.microsoft.com/win/2004/08/events/event'; freb='http://schemas.microsoft.com/win/2006/06/iis/freb' }
  $status = $x.failedRequest.Attributes['statusCode'].Value
  $sub = (Select-Xml -Xml $x -XPath "//ev:EventData/ev:Data[@Name='HttpSubStatus']" -Namespace $ns | Select-Object -Last 1).Node.'#text'
  $url = $x.failedRequest.Attributes['url'].Value
  $mod = (Select-Xml -Xml $x -XPath "//ev:Data[@Name='ModuleName']" -Namespace $ns | Select-Object -Last 1).Node.'#text'
  $note = (Select-Xml -Xml $x -XPath "//ev:RenderingInfo/freb:Description[@Data='Notification']" -Namespace $ns | Select-Object -Last 1).Node.'#text'
  Write-Host "$(Split-Path $p -Leaf): status=$status/$sub url=$url module=$mod notification=$note"
}