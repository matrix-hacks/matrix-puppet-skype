**WIP**

# skype-bridge

This is a Matrix bridge for Skype.

## features

- [ ] Skype to Matrix direct text message
- [ ] Matrix to Skype direct text message
- [ ] Skype to Matrix direct image attachment message
- [ ] Matrix to Skype direct image attachment message
- [ ] group messaging
- [ ] read receipts
- [ ] contact list syncing

## installation

clone this repo

cd into the directory

run `npm install`

## configure

Copy `config.sample.json` to `config.json` and update it to match your setup

## register the app service

Generate an `skype-registration.yaml` file with `node index.js -r -u "http://your-bridge-server:8090"`

Note: The 'registration' setting in the config.json needs to set to the path of this file. By default, it already is.

Copy this `skype-registration.yaml` file to your home server, then edit it, setting its url to point to your bridge server. e.g. `url: 'http://your-bridge-server.example.org:8090'`

Edit your homeserver.yaml file and update the `app_service_config_files` with the path to the `skype-registration.yaml` file.

Launch the bridge with ```node index.js```.

Restart your HS.

# TODO
* Be able to originate conversations from the Matrix side.
