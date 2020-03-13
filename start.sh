#!/bin/bash

MYDIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $MYDIR

DEBUG=*matrix-puppet:* exec node index.js ${@}
