FROM node:12.16

# app user configuration
ENV APPUSER=matrix-puppet-skype
ENV HOME=/srv/${APPUSER}
ENV SRCDIR=${HOME}/app

RUN apt-get -yq update \
        && DEBIAN_FRONTEND=noninteractive apt-get install -y \
                unattended-upgrades \
        && rm -rf /var/lib/apt/lists/*

# http://bitjudo.com/blog/2014/03/13/building-efficient-dockerfiles-node-dot-js/
# use changes to package.json to force Docker not to use the cache
# when we change our application's nodejs dependencies:
COPY package.json /tmp/package.json
RUN cd /tmp && npm install
RUN mkdir -p ${SRCDIR} && cp -a /tmp/node_modules ${SRCDIR}

# From here we load our application's code in, therefore the previous docker
# "layer" thats been cached will be used if possible
WORKDIR ${SRCDIR}
COPY . ${SRCDIR}

EXPOSE 8090
ENTRYPOINT ["/srv/matrix-puppet-skype/app/start.sh"]
