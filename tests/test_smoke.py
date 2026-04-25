from __future__ import annotations

import unittest

from app import create_app
from app.config import TestConfig
from app.extensions import db
from app.models import Conversation, ConversationParticipant, Friendship, User
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

    def test_add_friend_by_username_and_unfriend(self):
        self._register('Alice_123')
        alice = User.query.filter_by(username_normalized='alice_123').first()
        self._logout()
        self._register('Bob_12345')

        add = self.client.post('/api/friends', json={'identifier': 'Alice_123'}, headers={'X-CSRF-TOKEN': self._csrf()})
        self.assertEqual(add.status_code, 200)
        self.assertEqual(add.json['friend']['username'], 'Alice_123')

        friendship = Friendship.query.first()
        self.assertIsNotNone(friendship)

        remove = self.client.delete(f'/api/friends/{alice.id}', headers={'X-CSRF-TOKEN': self._csrf()})
        self.assertEqual(remove.status_code, 200)
        self.assertEqual(Friendship.query.count(), 0)

    def test_add_group_member_from_friend_list(self):
        self._register('Alice_123')
        alice = User.query.filter_by(username_normalized='alice_123').first()
        self._logout()
        self._register('Bob_12345')
        bob = User.query.filter_by(username_normalized='bob_12345').first()
        self.client.post('/api/friends', json={'identifier': 'Alice_123'}, headers={'X-CSRF-TOKEN': self._csrf()})

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
