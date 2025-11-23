#!/bin/bash
# Generate CA
openssl req -new -x509 -days 365 -keyout ca-key.pem -out ca-cert.pem -subj "//C=KY\ST=Grand Cayman\L=George Town\O=WPS\CN=WPS Root CA" -nodes

# Generate Server Cert
openssl req -newkey rsa:2048 -nodes -keyout server-key.pem -out server-req.pem -subj "//C=KY\ST=Grand Cayman\L=George Town\O=WPS\CN=localhost"
openssl x509 -req -in server-req.pem -days 365 -CA ca-cert.pem -CAkey ca-key.pem -CAcreateserial -out server-cert.pem

# Generate Client Cert
openssl req -newkey rsa:2048 -nodes -keyout client-key.pem -out client-req.pem -subj "//C=KY\ST=Grand Cayman\L=George Town\O=Bank\CN=Bank Client"
openssl x509 -req -in client-req.pem -days 365 -CA ca-cert.pem -CAkey ca-key.pem -CAcreateserial -out client-cert.pem

echo "Certificates generated."
