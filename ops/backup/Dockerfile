FROM postgres:15-alpine

RUN apk add --no-cache aws-cli ca-certificates curl openssl tzdata

COPY ops/backup/backup.sh /usr/local/bin/docentos-backup
COPY ops/backup/backup-loop.sh /usr/local/bin/docentos-backup-loop
COPY ops/backup/restore.sh /usr/local/bin/restore-backup

RUN chmod 0755 /usr/local/bin/docentos-backup /usr/local/bin/docentos-backup-loop /usr/local/bin/restore-backup

ENTRYPOINT ["/usr/local/bin/docentos-backup-loop"]
