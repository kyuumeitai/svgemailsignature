"use strict";

const express = require('express');
const fs = require('pn/fs');
const svg_to_png = require('svg-to-png');
const s = require("underscore.string");
const expressValidator = require('express-validator');
const bodyParser = require('body-parser');
const app = express();
const util = require('util');
const mkdirp = require('mkdirp');
const gm = require('gm');
const path = require('path');
const Promise = require('bluebird');
const {execFile} = require('child_process');
const gifsicle = require('gifsicle');

Promise.promisifyAll(gm.prototype);

let info = {};
let config = {
  // url : 'http://people.mad.cl',
  url : 'http://localhost:8081',
  static : 'public',
  path : 'signature'
};

app.use(expressValidator());
app.use(express.static(config.static));
app.set('views', './views');
app.set('view engine', 'pug');

app.get('/', function(req, res){
  //obligatorios
  
  req.checkQuery('nombre', 'No viene nombre').notEmpty();
  req.checkQuery('cargo', 'No viene cargo').notEmpty();
  
  info.direccion = req.query.direccion || 'Av. Nueva Providencia 1860 oficina 173';
  info.telefono = req.query.telefono || '+569 28984940';
  info.celular = req.query.celular || '';
  info.sitio = req.query.sitio || 'www.mad.cl';
  

  var errors = req.validationErrors();
  if(errors){
    res.status(400).send('errores:' + util.inspect(errors));
    return;
  }

  info.nombre = req.query.nombre;
  info.cargo = req.query.cargo;
  info.slug = s.dasherize(s.trim(s.cleanDiacritics(info.nombre).toLowerCase()));
  info.permalink = config.url +'/'+ info.slug +'/'+ config.path;

  console.log(info);
  fs.readFile("firma-base.svg", 'utf8')
    .then(source =>{
      var result = source.replace(/::NOMBRE::/g, info.nombre.toUpperCase());
      result = result.replace(/::CARGO::/g, info.cargo.toUpperCase());
      result = result.replace(/::DIRECCION::/g, info.direccion);
      result = result.replace(/::TELEFONO::/g, info.telefono);
      result = result.replace(/::CELULAR::/g, info.celular);      //IF EMPTY
      result = result.replace(/::SITIO::/g, info.sitio);
      console.log('result');
      return result;
    }
  )
  .then(result => {
    mkdirp(config.static+'/'+info.slug+'/'+config.path, function (err) {
      if (err) throw err;
      console.log('mkdirp');
      const userpath = path.resolve(path.join(__dirname, config.static+'/'+info.slug+'/'+config.path));
      const filename = userpath + '/' + info.slug;

      fs.writeFile(filename+'-alt.svg', result, 'utf8', (err) =>{
        if(err) throw err;
        console.log('svg!');
        svg_to_png.convert(filename + '-alt.svg', userpath)
          .then(function(){
            console.log('trim');
            gm(filename + '-alt.png')
            .trim()
            .write(filename + '-alt.png', function(err){
              console.log('trimmed');
              if(err) throw err;
              gm(filename+'-alt.png').size(function(err, size){
                if(err) throw err;
                res.render('index', { nombre: info.nombre, permalink: info.permalink, slug: info.slug , url: 'http://'+info.sitio, size: size, localurl: config.url })
              })
            })
          })
          .catch(e => console.error(e))
      })
    })
  })
});

var server = app.listen(8081, function () {
  var host = server.address().address
  var port = server.address().port
  console.log("Signatures in http://%s:%s", host, port)
})
