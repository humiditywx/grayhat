from __future__ import annotations

import io
import unittest

from app import create_app
from app.config import TestConfig
from app.extensions import db
from app.models import Attachment, Conversation, ConversationParticipant, FriendRequest, Friendship, User
from app.services.security import decrypt_secret, verify_totp


class MessengerSmokeTest(unittest.TestCase):
    def setUp(self):
        self.app = create_app(TestConfig)
        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()
        self.client = self.app.test_client()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def _csrf(self) -> str:
        cookie = self.client.get_cookie('csrf_access_token')
        self.assertIsNotNone(cookie)
        return cookie.value

    def _register(self, username: str, password: str = 'StrongPass1'):
        response = self.client.post('/api/auth/register', json={'username': username, 'password': password})
        self.assertIn(response.status_code, {200, 201})
        return response

    def _login(self, username: str, password: str = 'StrongPass1'):
        response = self.client.post('/api/auth/login', json={'username': username, 'password': password})
        self.assertEqual(response.status_code, 200)
        return response

    def _logout(self):
        self.client.post('/api/auth/logout', headers={'X-CSRF-TOKEN': self._csrf()})

    def _send_friend_request(self, target: User):
        response = self.client.post('/api/friends', json={'uuid': target.id}, headers={'X-CSRF-TOKEN': self._csrf()})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json['ok'])
        return response.json['request']

    def _accept_friend_request(self, request_id: str):
        response = self.client.post(f'/api/friends/requests/{request_id}/accept', headers={'X-CSRF-TOKEN': self._csrf()})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json['ok'])
        return response

    def test_register_totp_confirm_and_bootstrap(self):
        register = self._register('Alice_123')
        self.assertTrue(register.json['ok'])
        self.assertTrue(register.json['requires_totp_setup'])

        setup = self.client.post('/api/auth/totp/setup', headers={'X-CSRF-TOKEN': self._csrf()})
        self.assertEqual(setup.status_code, 200)
        self.assertEqual(len(setup.json['recovery_codes']), 10)

        user = User.query.filter_by(username_normalized='alice_123').first()
        self.assertIsNotNone(user)
        secret = decrypt_secret(user.totp_secret_encrypted)
        self.assertIsNotNone(secret)
        code = __import__('pyotp').TOTP(secret).now()
        self.assertTrue(verify_totp(secret, code))

        confirm = self.client.post('/api/auth/totp/confirm', json={'code': code}, headers={'X-CSRF-TOKEN': self._csrf()})
        self.assertEqual(confirm.status_code, 200)
        self.assertTrue(confirm.json['ok'])

        bootstrap = self.client.get('/api/bootstrap')
        self.assertEqual(bootstrap.status_code, 200)
        self.assertEqual(bootstrap.json['user']['username'], 'Alice_123')

    def test_send_friend_request_accept_and_unfriend(self):
        self._register('Alice_123')
        alice = User.query.filter_by(username_normalized='alice_123').first()
        self._logout()
        self._register('Bob_12345')

        request_payload = self._send_friend_request(alice)
        self.assertEqual(FriendRequest.query.count(), 1)

        self._logout()
        self._login('Alice_123')
        accept = self._accept_friend_request(request_payload['id'])
        self.assertEqual(accept.json['friend']['username'], 'Bob_12345')

        friendship = Friendship.query.first()
        self.assertIsNotNone(friendship)
        self.assertEqual(FriendRequest.query.count(), 0)

        self._logout()
        self._login('Bob_12345')
        remove = self.client.delete(f'/api/friends/{alice.id}', headers={'X-CSRF-TOKEN': self._csrf()})
        self.assertEqual(remove.status_code, 200)
        self.assertEqual(Friendship.query.count(), 0)

    def test_reverse_friend_request_after_unfriend_does_not_500(self):
        self._register('Alice_123')
        alice = User.query.filter_by(username_normalized='alice_123').first()
        self._logout()
        self._register('Bob_12345')
        bob = User.query.filter_by(username_normalized='bob_12345').first()

        request_payload = self._send_friend_request(alice)
        self._logout()
        self._login('Alice_123')
        self._accept_friend_request(request_payload['id'])

        remove = self.client.delete(f'/api/friends/{bob.id}', headers={'X-CSRF-TOKEN': self._csrf()})
        self.assertEqual(remove.status_code, 200)
        self.assertEqual(Friendship.query.count(), 0)
        self.assertEqual(FriendRequest.query.count(), 0)
        db.session.add(FriendRequest(sender_id=bob.id, receiver_id=alice.id, status='accepted'))
        db.session.commit()

        self._logout()
        self._login('Bob_12345')
        resend = self.client.post('/api/friends', json={'uuid': alice.id}, headers={'X-CSRF-TOKEN': self._csrf()})
        self.assertEqual(resend.status_code, 200)
        self.assertTrue(resend.json['ok'])
        self.assertEqual(resend.json['request']['sender_id'], bob.id)
        self.assertEqual(resend.json['request']['receiver_id'], alice.id)
        self.assertEqual(FriendRequest.query.count(), 1)

    def test_attachment_upload_accepts_mime_typed_extensionless_file(self):
        self._register('Alice_123')
        alice = User.query.filter_by(username_normalized='alice_123').first()
        self._logout()
        self._register('Bob_12345')

        private = self.client.post(
            f'/api/conversations/private/{alice.id}',
            headers={'X-CSRF-TOKEN': self._csrf()},
        )
        self.assertEqual(private.status_code, 200)
        conversation_id = private.json['conversation']['id']

        upload = self.client.post(
            f'/api/conversations/{conversation_id}/attachments',
            data={
                'file': (io.BytesIO(b'pretend image bytes'), 'picker-photo', 'image/png'),
            },
            headers={'X-CSRF-TOKEN': self._csrf()},
            content_type='multipart/form-data',
        )

        self.assertEqual(upload.status_code, 201, upload.json)
        self.assertTrue(upload.json['ok'])
        self.assertEqual(upload.json['message']['message_type'], 'image')
        self.assertEqual(upload.json['message']['attachments'][0]['kind'], 'image')

        attachment = Attachment.query.first()
        self.assertIsNotNone(attachment)
        self.assertTrue(attachment.storage_name.endswith('.png'))

    def test_add_group_member_from_friend_list(self):
        self._register('Alice_123')
        alice = User.query.filter_by(username_normalized='alice_123').first()
        self._logout()
        self._register('Bob_12345')
        bob = User.query.filter_by(username_normalized='bob_12345').first()

        request_payload = self._send_friend_request(alice)
        self._logout()
        self._login('Alice_123')
        self._accept_friend_request(request_payload['id'])
        self._logout()
        self._login('Bob_12345')

        group = self.client.post('/api/conversations/groups', json={'title': 'Project Team', 'description': 'Core group'}, headers={'X-CSRF-TOKEN': self._csrf()})
        self.assertEqual(group.status_code, 201)
        conversation_id = group.json['conversation']['id']

        add_member = self.client.post(
            f'/api/conversations/{conversation_id}/members',
            json={'user_id': alice.id},
            headers={'X-CSRF-TOKEN': self._csrf()},
        )
        self.assertEqual(add_member.status_code, 200)
        self.assertEqual(add_member.json['user']['username'], 'Alice_123')
        self.assertEqual(ConversationParticipant.query.filter_by(conversation_id=conversation_id).count(), 2)

        qr = self.client.get(f'/api/conversations/{conversation_id}/qr.png')
        self.assertEqual(qr.status_code, 200)
        self.assertEqual(qr.mimetype, 'image/png')

        self.assertEqual(Conversation.query.get(conversation_id).kind, 'group')
        self.assertNotEqual(alice.id, bob.id)


if __name__ == '__main__':
    unittest.main()
