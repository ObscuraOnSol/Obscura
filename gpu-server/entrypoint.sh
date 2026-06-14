#!/bin/sh

# Start SSH daemon in background
/usr/sbin/sshd

# Start ttyd exposing bash in foreground
exec ttyd -p 7681 bash
