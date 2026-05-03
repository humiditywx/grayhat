from __future__ import annotations

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from flask import current_app

def send_otp_email(to_email: str, otp_code: str, app_name: str, expires_in_mins: int = 15):
    smtp_host = current_app.config.get('SMTP_HOST')
    smtp_port = current_app.config.get('SMTP_PORT')
    smtp_user = current_app.config.get('SMTP_USER')
    smtp_pass = current_app.config.get('SMTP_PASS')
    from_email = current_app.config.get('MAIL_FROM', smtp_user)

    if not all([smtp_host, smtp_port, smtp_user, smtp_pass]):
        current_app.logger.warning("SMTP configuration is incomplete. Email not sent.")
        current_app.logger.info(f"OTP for {to_email}: {otp_code}")
        return

    # Load template
    template_path = Path('/home/humiditywx/Downloads/otp-login.html')
    if not template_path.exists():
        # Fallback to simple text if template not found
        html_content = f"Your OTP for {app_name} is {otp_code}. It expires in {expires_in_mins} minutes."
    else:
        with open(template_path, 'r') as f:
            html_content = f.read()

        # Replace placeholders
        html_content = html_content.replace('${appname}', app_name)
        html_content = html_content.replace('${time}', f"{expires_in_mins} minutes")
        html_content = html_content.replace('${otp}', otp_code)
        html_content = html_content.replace('${toEmail}', to_email)

    msg = MIMEMultipart('alternative')
    msg['Subject'] = f"Login to {app_name}"
    msg['From'] = from_email
    msg['To'] = to_email

    msg.attach(MIMEText(html_content, 'html'))

    try:
        with smtplib.SMTP_SSL(smtp_host, smtp_port) as server:
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
    except Exception as e:
        current_app.logger.error(f"Failed to send email: {e}")
        raise RuntimeError("Failed to send OTP email.")
