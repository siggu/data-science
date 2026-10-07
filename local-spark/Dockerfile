# Databricks Runtime 15.x/16.x LTS와 같은 Spark 3.5 계열 + Delta Lake 3.2 로컬 실습 환경
# (apt 없이 Java 17 JRE를 공식 Temurin 이미지에서 복사 → 빌드가 빠르고 사내 프록시 환경에서도 안정적)
FROM eclipse-temurin:17-jre AS jre
FROM python:3.11-slim-bookworm

COPY --from=jre /opt/java/openjdk /opt/java

ENV JAVA_HOME=/opt/java \
    PATH=/opt/java/bin:$PATH \
    PYTHONPATH=/opt/dbx \
    PRACTICE_DATA_DIR=/data \
    PYSPARK_PYTHON=python3

COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

RUN useradd -m -u 1000 -s /bin/bash analyst \
 && mkdir -p /opt/dbx /data /home/analyst/work /home/analyst/warehouse \
 && chown -R analyst:analyst /home/analyst
COPY dbx_local.py /opt/dbx/dbx_local.py
COPY --chown=analyst:analyst startup/ /home/analyst/.ipython/profile_default/startup/

USER analyst
WORKDIR /home/analyst/work
ENV PRACTICE_WAREHOUSE=/home/analyst/warehouse

# Delta Lake jar를 빌드 시점에 미리 받아둠 (컨테이너 첫 실행을 빠르게)
RUN python -c "import dbx_local as d; s = d.get_spark(); assert d.DELTA_ENABLED, 'Delta 활성화 실패'; s.stop()"

EXPOSE 8888 4040
CMD ["jupyter", "lab", "--ip=0.0.0.0", "--port=8888", "--no-browser", \
     "--IdentityProvider.token=", "--ServerApp.password=", "--ServerApp.root_dir=/home/analyst/work"]
