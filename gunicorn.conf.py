import multiprocessing
import os

bind = '127.0.0.1:8000'

workers = 1
threads = int(os.getenv('GUNICORN_THREADS', '100'))
worker_class = 'gthread'

timeout = 60
graceful_timeout = 30
keepalive = 5

accesslog = '-'
errorlog = '-'
loglevel = os.getenv('GUNICORN_LOG_LEVEL', 'info')

access_log_format = '%({x-forwarded-for}i)s - - [%(t)s] "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s"'

max_requests = 5000
max_requests_jitter = 500
