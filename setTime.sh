#/bin/bash

# This calls ntpd to set the time from the network
#
# this file needs to be setuid root to work
# sudo chown root:root setTime.sh && sudo chmod 4744 setTime.sh

/usr/bin/logger Trying to reset the time
echo "Calling ntpd to reset the time"
date
# according to Internet wisdom, a running ntpd needs to be stopped first, however this seems to set the time even when the daemon directly exits. Maybe not reliable?
#/etc/init.d/ntp stop
/usr/sbin/ntpd -g -q
#/etc/init.d/ntp start
date
