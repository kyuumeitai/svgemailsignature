'use strict';

const fs = require('fs');
const path = require('path');
const { inspect } = require('util');
const express = require('express');
const dasherize = require('underscore.string/dasherize');
const trim = require('underscore.string/trim');
const cleanDiacritics = require('underscore.string/cleanDiacritics');
const expressValidator = require('express-validator');
const mkdirp = require('mkdirp-then');
const gm = require('gm');
const Promise = require('bluebird');
const replaceStream = require('replacestream');

const imageMagick = gm.subClass({ imageMagick: true });
const app = express();
Promise.promisifyAll(gm.prototype);

const info = {};
const config = {
  url: 'http://localhost:8081',
  static: 'public',
  path: 'signature'
};

app.use(expressValidator());
app.use(express.static(config.static));
app.set('views', './views');
app.set('view engine', 'pug');

app.get('/', (req, res) => {
  // obligatorios
  req.checkQuery('nombre', 'No viene nombre').notEmpty();
  req.checkQuery('cargo', 'No viene cargo').notEmpty();
  info.direccion =
    req.query.direccion || 'Av. Nueva Providencia 1860 oficina 173';
  info.telefono = req.query.telefono || '+569 28984940';
  info.celular = req.query.celular || '';
  info.sitio = req.query.sitio || 'www.mad.cl';
  const errors = req.validationErrors();
  if (errors) {
    return res.status(400).send(`errores: ${inspect(errors)}`);
  }
  info.nombre = req.query.nombre;
  info.cargo = req.query.cargo;
  info.slug = dasherize(trim(cleanDiacritics(info.nombre).toLowerCase()));
  info.permalink = `${config.url}/${info.slug}/${config.path}`;
  const userpath = path.join(__dirname, config.static, info.slug, config.path);
  const filename = path.join(userpath, info.slug);
  mkdirp(userpath)
    .then(() => {
      const svgStream = fs
        .createReadStream(path.join(__dirname, 'firma-base.svg'))
        .pipe(replaceStream(/::NOMBRE::/g, info.nombre.toUpperCase()))
        .pipe(replaceStream(/::CARGO::/g, info.cargo.toUpperCase()))
        .pipe(replaceStream(/::DIRECCION::/g, info.direccion))
        .pipe(replaceStream(/::TELEFONO::/g, info.telefono))
        .pipe(replaceStream(/::CELULAR::/g, info.celular))
        .pipe(replaceStream(/::SITIO::/g, info.sitio));
      return imageMagick(svgStream).trim().streamAsync('png');
    })
    .then((stdout, stderr) => {
      return new Promise((resolve, reject) => {
        const pngStream = fs.createWriteStream(`${filename}-alt.png`);
        stdout.pipe(pngStream);
        pngStream.on('finish', () => {
          const rs = fs.createReadStream(`${filename}-alt.png`);
          return imageMagick(rs).sizeAsync().then(resolve).catch(reject);
        });
      });
    })
    .then(size => {
      res.render('index', {
        nombre: info.nombre,
        permalink: info.permalink,
        slug: info.slug,
        url: `http://${info.sitio}`,
        size: size,
        localurl: config.url
      });
    })
    .catch(err => console.error(err));
});

const server = app.listen(8081, () => {
  const host = server.address().address;
  const port = server.address().port;
  console.log(`Signatures in http://${host}:${port}`);
});
