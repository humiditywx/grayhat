from flask import Blueprint, jsonify, request
from flask_jwt_extended import current_user, jwt_required
from functools import wraps
from ..extensions import db
from ..models import User, AuditLog
from ..services.security import hash_password, generate_secure_otp
from ..services.serializers import serialize_user
from sqlalchemy import desc

admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')

def admin_required(fn):
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        if not current_user.email.endswith('@grayhat.com.az'):
            return jsonify({'ok': False, 'error': 'Admin access required.'}), 403
        return fn(*args, **kwargs)
    return wrapper

@admin_bp.before_request
@admin_required
def before_request():
    pass

@admin_bp.get('/users')
def list_users():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    
    users_query = User.query.order_by(User.created_at.desc())
    
    search = request.args.get('search', '')
    if search:
        users_query = users_query.filter(
            (User.username.ilike(f'%{search}%')) | 
            (User.email.ilike(f'%{search}%'))
        )
        
    pagination = users_query.paginate(page=page, per_page=per_page, error_out=False)
    
    users_data = []
    for u in pagination.items:
        u_data = serialize_user(u)
        u_data['is_banned'] = u.is_banned
        users_data.append(u_data)
        
    return jsonify({
        'ok': True,
        'users': users_data,
        'total': pagination.total,
        'pages': pagination.pages,
        'current_page': page
    })

@admin_bp.get('/users/<user_id>')
def get_user(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({'ok': False, 'error': 'User not found.'}), 404
        
    u_data = serialize_user(user)
    u_data['is_banned'] = user.is_banned
    
    return jsonify({
        'ok': True,
        'user': u_data
    })

@admin_bp.put('/users/<user_id>/ban')
def toggle_ban(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({'ok': False, 'error': 'User not found.'}), 404
        
    if user.id == current_user.id:
        return jsonify({'ok': False, 'error': 'You cannot ban yourself.'}), 400
        
    payload = request.get_json(silent=True) or {}
    is_banned = bool(payload.get('is_banned', True))
    
    user.is_banned = is_banned
    
    # Log the action
    action = 'user_banned' if is_banned else 'user_unbanned'
    audit = AuditLog(admin_id=current_user.id, target_user_id=user.id, action=action, details={})
    db.session.add(audit)
    
    db.session.commit()
    return jsonify({'ok': True, 'message': 'User ban status updated.'})

@admin_bp.post('/users/<user_id>/password-reset')
def reset_password(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({'ok': False, 'error': 'User not found.'}), 404
        
    new_password = generate_secure_otp(12) + "aA1!" # Ensuring it passes validate_password checks
    
    user.password_hash = hash_password(new_password)
    user.token_version += 1
    
    # Log the action
    audit = AuditLog(admin_id=current_user.id, target_user_id=user.id, action='admin_password_reset', details={})
    db.session.add(audit)
    
    db.session.commit()
    
    return jsonify({
        'ok': True, 
        'message': 'Password reset successfully.',
        'new_password': new_password
    })

@admin_bp.get('/audit-logs')
def get_audit_logs():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    
    logs_query = AuditLog.query.order_by(AuditLog.created_at.desc())
    pagination = logs_query.paginate(page=page, per_page=per_page, error_out=False)
    
    logs_data = []
    for log in pagination.items:
        logs_data.append({
            'id': log.id,
            'admin_id': log.admin_id,
            'admin_username': log.admin.username if log.admin else None,
            'target_user_id': log.target_user_id,
            'target_username': log.target_user.username if log.target_user else None,
            'action': log.action,
            'details': log.details,
            'created_at': log.created_at.isoformat()
        })
        
    return jsonify({
        'ok': True,
        'logs': logs_data,
        'total': pagination.total,
        'pages': pagination.pages,
        'current_page': page
    })
