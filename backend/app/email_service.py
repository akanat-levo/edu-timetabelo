"""Email service for sending task reminders."""

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime

from .config import settings


def send_overdue_task_email(user_email: str, task_title: str, task_date: str, end_time: str) -> bool:
    """Send an email notification for an overdue task.

    Returns True if sent successfully, False otherwise.
    """
    if not settings.smtp_enabled or not settings.smtp_username:
        return False

    try:
        subject = f"Task Due: {task_title}"

        body = f"""
Hello,

Your task "{task_title}" scheduled for {task_date} at {end_time} is now overdue and has not been marked as complete.

Please log in to your timetable and either complete this task or cancel it if it's no longer needed.

Task Details:
- Title: {task_title}
- Date: {task_date}
- End Time: {end_time}

Best regards,
EDU Timetable
"""

        message = MIMEMultipart()
        message["From"] = settings.smtp_from_email
        message["To"] = user_email
        message["Subject"] = subject
        message.attach(MIMEText(body, "plain"))

        with smtplib.SMTP(settings.smtp_server, settings.smtp_port) as server:
            server.starttls()
            server.login(settings.smtp_username, settings.smtp_password)
            server.send_message(message)

        return True
    except Exception as e:
        print(f"Failed to send email to {user_email}: {str(e)}")
        return False
