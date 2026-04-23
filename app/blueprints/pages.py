from flask import Blueprint, render_template

pages_bp = Blueprint('pages', __name__)


@pages_bp.get('/')
def index():
    return render_template('index.html', page='home', share_token='', friend_uuid='')


@pages_bp.get('/g/<share_token>')
def group_join_page(share_token: str):
    return render_template('index.html', page='group', share_token=share_token, friend_uuid='')


@pages_bp.get('/add/<friend_uuid>')
def add_friend_page(friend_uuid: str):
    return render_template('index.html', page='friend', share_token='', friend_uuid=friend_uuid)
