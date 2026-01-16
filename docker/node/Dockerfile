FROM node:18-alpine

WORKDIR /app


RUN apk add --no-cache gcc g++ make python3 && \
    npm install -g typescript ts-node


RUN deluser node 2>/dev/null || true && \
    adduser -D -u 1000 coderunner && \
    chown -R coderunner:coderunner /app

USER coderunner

CMD ["node"]