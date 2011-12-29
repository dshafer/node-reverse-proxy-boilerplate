var sys = require('sys'),
    fs = require('fs'),
    util = require('util'),
    http = require('http'),
    httpProxy = require('http-proxy');

var incomingPort=80;
var defaultHandlerPort=8000;
var routeFile = __dirname + "/proxy-hosts.json";
var hosts = null;
loadHosts(routeFile, hosts);

fs.watchFile(routeFile, function (curr, prev) {
  try{
    console.log("curr:\n" + util.inspect(curr));
    loadHosts(routeFile, hosts);
  }
  catch(err){
    console.log("filewatcher: error parsing " + routeFile + ":\n" + util.inspect(err));
  }
}); 

httpProxy.createServer(function (req, res, proxy) {
  console.log("forwarding " + req.headers['host'] + req.url);
  for(var i = 0; i < hosts.length; i++){
    var host = hosts[i];
    if (req.headers['host'].match(host.nameRE)){
      console.log("  hostname match: " + host.name);
      for(var j = 0; j < host.destinations.length; j++){
        var dest = host.destinations[j];
        if ( destinationMatch(req, res, proxy, dest)) {
          forward(req, res, proxy, dest);
          return;
        }
      }
    }
  }

  // if we got here, there was no match.  Forward to default handler
  console.log("  no match.");
  proxy.proxyRequest(req, res, {
    host: 'localhost',
    port: 82
  });
}).listen(80);

http.createServer(function (req, res) {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.write('you have hit the reverse proxy at drewshafer.com<br/><br/>');
  res.write('probably you meant to go to one of these sites:<br/>');
  for (var i = 0; i < hosts.length; i++){
    var host = hosts[i];
    for (var j = 0; j < host.destinations.length; j++){
      var dest = host.destinations[j];
      res.write("&nbsp;&nbsp;&nbsp;&nbsp;");
      var destHost = 'http://' + host.name;
      if(!(typeof dest.url === "undefined")){
        destHost += dest.url;
      }
      res.write('<a href="' + destHost + '">' + destHost + '</a><br/>');
    }
  }
  res.end();
}).listen(82);

function destinationMatch(req, res, proxy, dest) {
  if(!(typeof dest.urlRE === "undefined")){
    // check against the url
    if (req.url.match(dest.urlRE)){
      return true;
    }
  }
  else { // no url route defined - just forward to destination
    return true;
  }
  return false;
}

function forward(req, res, proxy, dest) {
  var destHost = dest.destinationHost;
  if(typeof destHost === "undefined") {destHost = 'localhost';}
  proxy.proxyRequest(req, res, {
    host: destHost,
    port: dest.port
  });
}

function loadHosts(fname, ret) {
  console.log("loadHosts: " + fname);
  fs.readFile(fname, function(err, data) {
    if (err) throw err;
    try
    {
      var raw = JSON.parse(data);
      for(var i = 0; i < raw.hosts.length; i++){
        raw.hosts[i].nameRE = new RegExp(raw.hosts[i].name);
        for (var j = 0; j < raw.hosts[i].destinations.length; j++){
          var dest = raw.hosts[i].destinations[j];
          if(!(typeof dest.url === "undefined")){
            dest.urlRE = new RegExp('^' + dest.url);
          }
        }
      }
      hosts = raw.hosts;
    }
    catch(e){
      console.log("loadHosts: error parsing " + routeFile + ":\n" + e.message);
    }

  });

}

