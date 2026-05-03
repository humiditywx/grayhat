from __future__ import annotations

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from flask import current_app

def send_otp_email(to_email: str, otp_code: str, app_name: str, expires_in_mins: int = 15):
    smtp_host = current_app.config.get('SMTP_HOST')
    smtp_port = int(current_app.config.get('SMTP_PORT', 465))
    smtp_user = current_app.config.get('SMTP_USER')
    smtp_pass = current_app.config.get('SMTP_PASS')
    from_email = current_app.config.get('MAIL_FROM') or smtp_user

    if not all([smtp_host, smtp_port, smtp_user, smtp_pass]):
        current_app.logger.warning("SMTP configuration is incomplete. Email not sent.")
        current_app.logger.info(f"OTP for {to_email}: {otp_code}")
        return

    # Load template
    template_path = Path(current_app.root_path) / 'static' / 'otp-login.html'
    if not template_path.exists():
        current_app.logger.warning(f"Template not found at {template_path}. Falling back to text.")
        html_content = f"Your OTP for {app_name} is {otp_code}. It expires in {expires_in_mins} minutes."
    else:
        try:
            with open(template_path, 'r') as f:
                html_content = f.read()

            # Replace placeholders
            html_content = html_content.replace('${appname}', app_name)
            html_content = html_content.replace('${time}', f"{expires_in_mins} minutes")
            html_content = html_content.replace('${otp}', otp_code)
            html_content = html_content.replace('${toEmail}', to_email)
        except Exception as e:
            current_app.logger.error(f"Error reading template at {template_path}: {e}")
            html_content = f"Your OTP for {app_name} is {otp_code}. It expires in {expires_in_mins} minutes."

    msg = MIMEMultipart('alternative')
    msg['Subject'] = f"Login to {app_name}"
    msg['From'] = from_email
    msg['To'] = to_email

    msg.attach(MIMEText(html_content, 'html'))

    try:
        # Use SMTP_SSL for port 465, regular SMTP for others (like 587 with STARTTLS)
        if smtp_port == 465:
            with smtplib.SMTP_SSL(smtp_host, smtp_port) as server:
                server.login(smtp_user, smtp_pass)
                server.send_message(msg)
        else:
            with smtplib.SMTP(smtp_host, smtp_port) as server:
                if smtp_port == 587:
                    server.starttls()
                server.login(smtp_user, smtp_pass)
                server.send_message(msg)
    except Exception as e:
        import traceback
        current_app.logger.error(f"Failed to send email to {to_email}: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        raise RuntimeError(f"Failed to send OTP email: {str(e)}")
