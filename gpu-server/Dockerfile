FROM alpine:latest

# Install SSH, ttyd, and bash
RUN apk update && apk add --no-cache openssh-server ttyd bash

# Configure SSH daemon
RUN ssh-keygen -A && \
    echo 'root:obscura' | chpasswd && \
    sed -i 's/#PermitRootLogin.*/PermitRootLogin yes/' /etc/ssh/sshd_config && \
    sed -i 's/#PasswordAuthentication.*/PasswordAuthentication yes/' /etc/ssh/sshd_config && \
    echo "PasswordAuthentication yes" >> /etc/ssh/sshd_config

# Expose ports
EXPOSE 22 7681

# Startup script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
