"""Comments router - Handle ticket comments with @mentions"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import re
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import sys
sys.path.append('..')
from database import get_db
from models.comment import Comment
from models.work_item import WorkItem
from models.developer import Developer

router = APIRouter(prefix="/api/comments", tags=["comments"])


class CommentCreate(BaseModel):
    work_item_id: int
    content: str
    author_id: int
    comment_type: str = "comment"  # comment, blocker, status_change


class CommentUpdate(BaseModel):
    content: str


class CommentResponse(BaseModel):
    id: int
    work_item_id: int
    author_id: Optional[int]
    author_name: str
    content: str
    mentions: List[int]
    comment_type: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


def extract_mentions(content: str) -> List[int]:
    """Extract @mentioned user IDs from content. Format: @123 or @name"""
    # Match @id pattern (e.g., @123)
    mention_pattern = r'@(\d+)'
    matches = re.findall(mention_pattern, content)
    return [int(m) for m in matches]


def send_email_notification(
    to_email: str,
    to_name: str,
    author_name: str,
    work_item_key: str,
    work_item_title: str,
    comment_content: str,
    is_blocker: bool = False
):
    """Send email notification for @mentions"""
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_password = os.getenv("SMTP_PASSWORD", "")
    from_email = os.getenv("SMTP_FROM_EMAIL", smtp_user)
    
    if not smtp_user or not smtp_password:
        print(f"SMTP not configured. Would send email to {to_email}")
        return False
    
    try:
        subject_type = "🚫 BLOCKER" if is_blocker else " Mention"
        subject = f"{subject_type}: You were mentioned in {work_item_key}"
        
        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <h2 style="color: {'#DC2626' if is_blocker else '#6366F1'}; margin-top: 0;">
                    {'🚫 BLOCKER Alert!' if is_blocker else 'You were mentioned!'}
                </h2>
                <p style="color: #333; font-size: 16px;">
                    Hi <strong>{to_name}</strong>,
                </p>
                <p style="color: #333; font-size: 16px;">
                    <strong>{author_name}</strong> mentioned you in ticket <strong>{work_item_key}</strong>:
                </p>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid {'#DC2626' if is_blocker else '#6366F1'};">
                    <p style="margin: 0; color: #555;"><strong>{work_item_title}</strong></p>
                </div>
                <div style="background: #fff; padding: 15px; border: 1px solid #e0e0e0; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0; color: #333; white-space: pre-wrap;">{comment_content}</p>
                </div>
                {'<p style="color: #DC2626; font-weight: bold;">⚠️ This is marked as a BLOCKER and requires your attention!</p>' if is_blocker else ''}
                <p style="color: #666; font-size: 14px; margin-top: 30px;">
                    This is an automated notification from Arsenal Ops.
                </p>
            </div>
        </body>
        </html>
        """
        
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = from_email
        msg['To'] = to_email
        
        html_part = MIMEText(html_body, 'html')
        msg.attach(html_part)
        
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.sendmail(from_email, to_email, msg.as_string())
        
        print(f"Email sent to {to_email}")
        return True
    except Exception as e:
        print(f"Failed to send email: {e}")
        return False


@router.get("/workitem/{work_item_id}", response_model=List[CommentResponse])
async def get_comments(work_item_id: int, db: Session = Depends(get_db)):
    """Get all comments for a work item"""
    comments = db.query(Comment).filter(
        Comment.work_item_id == work_item_id
    ).order_by(Comment.created_at.desc()).all()
    
    result = []
    for comment in comments:
        author_name = "Unknown"
        if comment.author_id and comment.author:
            author_name = comment.author.name
        
        result.append(CommentResponse(
            id=comment.id,
            work_item_id=comment.work_item_id,
            author_id=comment.author_id,
            author_name=author_name,
            content=comment.content,
            mentions=comment.mentions or [],
            comment_type=comment.comment_type,
            created_at=comment.created_at,
            updated_at=comment.updated_at
        ))
    
    return result


@router.post("/", response_model=CommentResponse)
async def create_comment(comment: CommentCreate, db: Session = Depends(get_db)):
    """Create a new comment with @mentions"""
    # Verify work item exists
    work_item = db.query(WorkItem).filter(WorkItem.id == comment.work_item_id).first()
    if not work_item:
        raise HTTPException(status_code=404, detail="Work item not found")
    
    # Extract mentions from content
    mentions = extract_mentions(comment.content)
    
    # Create comment
    new_comment = Comment(
        work_item_id=comment.work_item_id,
        author_id=comment.author_id,
        content=comment.content,
        mentions=mentions,
        comment_type=comment.comment_type
    )
    
    db.add(new_comment)
    db.commit()
    db.refresh(new_comment)
    
    # Get author name
    author = db.query(Developer).filter(Developer.id == comment.author_id).first()
    author_name = author.name if author else "Unknown"
    
    # Send email notifications to mentioned users
    is_blocker = comment.comment_type == "blocker"
    for mentioned_id in mentions:
        mentioned_user = db.query(Developer).filter(Developer.id == mentioned_id).first()
        if mentioned_user and mentioned_user.email:
            send_email_notification(
                to_email=mentioned_user.email,
                to_name=mentioned_user.name,
                author_name=author_name,
                work_item_key=work_item.key,
                work_item_title=work_item.title,
                comment_content=comment.content,
                is_blocker=is_blocker
            )
    
    return CommentResponse(
        id=new_comment.id,
        work_item_id=new_comment.work_item_id,
        author_id=new_comment.author_id,
        author_name=author_name,
        content=new_comment.content,
        mentions=new_comment.mentions or [],
        comment_type=new_comment.comment_type,
        created_at=new_comment.created_at,
        updated_at=new_comment.updated_at
    )


@router.put("/{comment_id}", response_model=CommentResponse)
async def update_comment(comment_id: int, update: CommentUpdate, db: Session = Depends(get_db)):
    """Update a comment"""
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    comment.content = update.content
    comment.mentions = extract_mentions(update.content)
    
    db.commit()
    db.refresh(comment)
    
    author_name = "Unknown"
    if comment.author_id and comment.author:
        author_name = comment.author.name
    
    return CommentResponse(
        id=comment.id,
        work_item_id=comment.work_item_id,
        author_id=comment.author_id,
        author_name=author_name,
        content=comment.content,
        mentions=comment.mentions or [],
        comment_type=comment.comment_type,
        created_at=comment.created_at,
        updated_at=comment.updated_at
    )


@router.delete("/{comment_id}")
async def delete_comment(comment_id: int, db: Session = Depends(get_db)):
    """Delete a comment"""
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    db.delete(comment)
    db.commit()
    
    return {"message": "Comment deleted"}
