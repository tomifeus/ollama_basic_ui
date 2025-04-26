FROM ubuntu

ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=America/New_York

RUN apt update && apt -y upgrade
RUN apt install -y tzdata python3 
RUN apt clean 

RUN mkdir -p /opt/www
RUN mkdir -p /opt/www/images

COPY *.ico *.html *.js *.css /opt/www
COPY images/powerllama.png /opt/www/images

ENTRYPOINT ["python3", "-m" ,"http.server", "4242", "-d", "/opt/www"]
