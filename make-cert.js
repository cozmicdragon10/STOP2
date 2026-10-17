// Creates a self-signed TLS certificate for local HTTPS use.
//
// Run with `npm run cert`. Writes certs/key.pem and certs/cert.pem, which
// server.js reads by default. Browsers will warn about a self-signed certificate;
// use a certificate from a real CA for anything public.
const fs = require("fs");
const path = require("path");
const selfsigned = require("selfsigned");

const CERT_DIR = path.join(__dirname, "certs");

const attrs = [{ name: "commonName", value: "localhost" }];
const options = {
  days: 365,
  keySize: 2048,
  algorithm: "sha256",
  extensions: [
    {
      name: "subjectAltName",
      altNames: [
        { type: 2, value: "localhost" },
        { type: 7, ip: "127.0.0.1" },
      ],
    },
  ],
};

const pems = selfsigned.generate(attrs, options);

fs.mkdirSync(CERT_DIR, { recursive: true });
fs.writeFileSync(path.join(CERT_DIR, "key.pem"), pems.private, { mode: 0o600 });
fs.writeFileSync(path.join(CERT_DIR, "cert.pem"), pems.cert);

console.log(`Wrote ${path.join(CERT_DIR, "key.pem")} and ${path.join(CERT_DIR, "cert.pem")}`);
