FROM gcc:12-bookworm

WORKDIR /app

RUN useradd -m -u 1000 coderunner && \
    chown -R coderunner:coderunner /app

USER coderunner

CMD ["/bin/bash"]