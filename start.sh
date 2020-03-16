#!/bin/bash

MYDIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $MYDIR

if ! [ -f "./config.json" ]; then
	>&2 echo "matrix-puppet-skype: create the ./config.json before run"
	exit 1
fi

DEBUG=*matrix-puppet:* exec node index.js ${@}
