"""
Email Service - Handle all email notifications
Supports Gmail SMTP and generic SMTP configurations
"""
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class EmailService:
    """Service for sending email notifications"""
    
    def __init__(self):
        self.smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user = os.getenv("SMTP_USER", "")
        self.smtp_password = os.getenv("SMTP_PASSWORD", "")
        self.from_email = os.getenv("SMTP_FROM_EMAIL", self.smtp_user)
        self.from_name = os.getenv("SMTP_FROM_NAME", "Arsenal Ops")
    
    def is_configured(self) -> bool:
        """Check if SMTP is properly configured"""
        return bool(self.smtp_user and self.smtp_password)
    
    def send_email(
        self,
        to_email: str,
        subject: str,
        html_body: str,
        text_body: Optional[str] = None
    ) -> bool:
        """
        Send an email via SMTP
        
        Args:
            to_email: Recipient email address
            subject: Email subject
            html_body: HTML email body
            text_body: Plain text fallback (optional)
        
        Returns:
            True if successful, False otherwise
        """
        if not self.is_configured():
            logger.warning(f"SMTP not configured. Would send email to {to_email}")
            return False
        
        try:
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = f"{self.from_name} <{self.from_email}>"
            msg['To'] = to_email
            
            if text_body:
                text_part = MIMEText(text_body, 'plain')
                msg.attach(text_part)
            
            html_part = MIMEText(html_body, 'html')
            msg.attach(html_part)
            
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.sendmail(self.from_email, to_email, msg.as_string())
            
            logger.info(f"Email sent to {to_email} with subject: {subject}")
            return True
        
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}")
            return False
    
    def send_task_assignment_notification(
        self,
        to_email: str,
        to_name: str,
        assigner_name: str,
        work_item_key: str,
        work_item_title: str,
        work_item_description: str,
        priority: str = "medium",
        due_date: Optional[str] = None
    ) -> bool:
        """Send notification when a task is assigned to someone"""
        priority_color = {
            "critical": "#DC2626",
            "high": "#F97316",
            "medium": "#6366F1",
            "low": "#10B981"
        }.get(priority, "#6366F1")
        
        priority_emoji = {
            "critical": "🔴",
            "high": "🟠",
            "medium": "🟡",
            "low": "🟢"
        }.get(priority, "🟡")
        
        html_body = f"""
        <html>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 0; margin: 0; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.1); margin-top: 20px;">
                <div style="border-left: 4px solid {priority_color}; padding-left: 20px; margin-bottom: 30px;">
                    <h2 style="color: #1f2937; margin: 0 0 10px 0; font-size: 24px;">
                        {priority_emoji} Task Assignment
                    </h2>
                    <p style="color: #6b7280; margin: 0; font-size: 14px;">
                        You have been assigned a new task
                    </p>
                </div>
                
                <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #e5e7eb;">
                    <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                        <strong>{work_item_key}</strong> • Priority: <span style="color: {priority_color}; font-weight: bold;">{priority.upper()}</span>
                    </p>
                    <h3 style="margin: 10px 0; color: #1f2937; font-size: 18px;">
                        {work_item_title}
                    </h3>
                    <p style="margin: 10px 0 0 0; color: #4b5563; font-size: 14px; line-height: 1.6;">
                        {work_item_description}
                    </p>
                    {f'<p style="margin: 15px 0 0 0; color: #6b7280; font-size: 13px;"><strong>Due Date:</strong> {due_date}</p>' if due_date else ''}
                </div>
                
                <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
                    <p style="margin: 0; color: #1e40af; font-size: 14px;">
                        <strong>{assigner_name}</strong> assigned you this task
                    </p>
                </div>
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 12px; margin: 0;">
                        This is an automated notification from <strong>Arsenal Ops</strong>. 
                        Log in to view and manage your tasks.
                    </p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_body = f"""
Task Assignment

You have been assigned a new task: {work_item_key}

Title: {work_item_title}

Description: {work_item_description}

Priority: {priority.upper()}
{"Due Date: " + due_date if due_date else ""}

Assigned by: {assigner_name}

Log in to Arsenal Ops to view and manage your tasks.
        """
        
        return self.send_email(
            to_email=to_email,
            subject=f"📋 Task Assignment: {work_item_key} - {work_item_title}",
            html_body=html_body,
            text_body=text_body
        )
    
    def send_mention_notification(
        self,
        to_email: str,
        to_name: str,
        author_name: str,
        work_item_key: str,
        work_item_title: str,
        comment_content: str,
        is_blocker: bool = False
    ) -> bool:
        """Send notification when user is mentioned in a comment"""
        color = "#DC2626" if is_blocker else "#6366F1"
        emoji = "🚫" if is_blocker else "💬"
        notification_type = "BLOCKER Alert" if is_blocker else "Mention"
        
        html_body = f"""
        <html>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 0; margin: 0; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.1); margin-top: 20px;">
                <div style="border-left: 4px solid {color}; padding-left: 20px; margin-bottom: 30px;">
                    <h2 style="color: {'#7f1d1d' if is_blocker else '#1f2937'}; margin: 0 0 10px 0; font-size: 24px;">
                        {emoji} {notification_type}
                    </h2>
                    <p style="color: #6b7280; margin: 0; font-size: 14px;">
                        {'You were mentioned in a blocking issue' if is_blocker else 'You were mentioned in a comment'}
                    </p>
                </div>
                
                <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 20px 0;">
                    Hi <strong>{to_name}</strong>,
                </p>
                
                <p style="color: #374151; font-size: 16px; margin: 20px 0;">
                    <strong>{author_name}</strong> mentioned you in <strong>{work_item_key}</strong>
                </p>
                
                <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid {color};">
                    <p style="margin: 0 0 15px 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                        <strong>{work_item_key}</strong>
                    </p>
                    <p style="margin: 0 0 15px 0; color: #1f2937; font-size: 16px; font-weight: bold;">
                        {work_item_title}
                    </p>
                    <div style="background: white; padding: 15px; border-radius: 6px; margin-top: 10px; border: 1px solid #e2e8f0;">
                        <p style="margin: 0; color: #374151; font-size: 14px; white-space: pre-wrap; line-height: 1.6;">
                            {comment_content}
                        </p>
                    </div>
                </div>
                
                {'<p style="color: #991b1b; background: #fee2e2; padding: 15px; border-radius: 8px; margin: 20px 0; font-weight: bold;">⚠️ This comment is marked as a BLOCKER and requires your attention!</p>' if is_blocker else ''}
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 12px; margin: 0;">
                        This is an automated notification from <strong>Arsenal Ops</strong>. 
                        Log in to respond or view more details.
                    </p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_body = f"""
{notification_type}

Hi {to_name},

{author_name} mentioned you in {work_item_key}:

{work_item_title}

Comment:
{comment_content}

{'⚠️ This comment is marked as a BLOCKER and requires your attention!' if is_blocker else ''}

Log in to Arsenal Ops to respond or view more details.
        """
        
        subject_prefix = "🚫 BLOCKER:" if is_blocker else "💬"
        return self.send_email(
            to_email=to_email,
            subject=f"{subject_prefix} You were mentioned in {work_item_key}",
            html_body=html_body,
            text_body=text_body
        )


# Create a singleton instance
email_service = EmailService()
