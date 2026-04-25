import os
from flask import Blueprint, send_from_directory

pages_bp = Blueprint('pages', __name__)

_DIST = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'static', 'dist')


def _spa():
    return send_from_directory(_DIST, 'index.html')


@pages_bp.get('/')
def index():
    return _spa()


@pages_bp.get('/g/<path:share_token>')
def group_join_page(share_token: str):
    return _spa()


@pages_bp.get('/add/<path:friend_uuid>')
def add_friend_page(friend_uuid: str):
    return _spa()
