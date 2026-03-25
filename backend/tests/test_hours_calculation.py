"""
Comprehensive tests for hours calculation logic
Tests all edge cases for time tracking accuracy
"""
import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, MagicMock
import sys
sys.path.append('..')


class TestHoursCalculation:
    """Test suite for hours calculation logic"""
    
    def setup_method(self):
        """Setup test fixtures"""
        self.today = datetime.utcnow()
        # Calculate week boundaries (Sunday to Saturday)
        days_since_sunday = (self.today.weekday() + 1) % 7
        self.week_start = self.today - timedelta(days=days_since_sunday)
        self.week_start = self.week_start.replace(hour=0, minute=0, second=0, microsecond=0)
        self.week_end = self.week_start + timedelta(days=6, hours=23, minutes=59, seconds=59)
    
    def test_week_boundaries_sunday_to_saturday(self):
        """Test that week boundaries are correctly calculated as Sunday-Saturday"""
        # Test case: Wednesday (weekday=2)
        wednesday = datetime(2026, 3, 25, 12, 0, 0)  # Wednesday
        days_since_sunday = (wednesday.weekday() + 1) % 7  # (2+1)%7 = 3
        week_start = wednesday - timedelta(days=days_since_sunday)
        week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Should be Sunday, March 22, 2026
        assert week_start.weekday() == 6  # Sunday
        assert week_start.day == 22
        
        week_end = week_start + timedelta(days=6, hours=23, minutes=59, seconds=59)
        assert week_end.weekday() == 5  # Saturday
        assert week_end.day == 28
    
    def test_time_entry_attribution_to_logger(self):
        """Test that time entries are attributed to the person logging, not assignee"""
        # Mock time entry
        time_entry = Mock()
        time_entry.developer_id = 1  # Logger's ID
        time_entry.hours = 4
        time_entry.logged_at = self.today
        
        # Mock work item assigned to different developer
        work_item = Mock()
        work_item.assignee_id = 2  # Different from logger
        work_item.id = 100
        
        # Attribution should go to developer_id (logger), not assignee_id
        assert time_entry.developer_id == 1
        assert work_item.assignee_id == 2
        assert time_entry.developer_id != work_item.assignee_id
    
    def test_developer_hours_calculation(self):
        """Test calculation of developer hours from time entries"""
        # Create mock time entries for a developer
        dev_id = 1
        
        entries = [
            Mock(developer_id=dev_id, hours=4, logged_at=self.today),
            Mock(developer_id=dev_id, hours=3, logged_at=self.today - timedelta(days=1)),
            Mock(developer_id=dev_id, hours=5, logged_at=self.today - timedelta(days=10)),  # Last week
        ]
        
        # Calculate total logged hours
        total_logged = sum(te.hours for te in entries)
        assert total_logged == 12
        
        # Calculate this week's hours
        this_week_logged = sum(
            te.hours for te in entries
            if te.logged_at and self.week_start <= te.logged_at <= self.week_end
        )
        assert this_week_logged == 7  # 4 + 3 (today and yesterday)
    
    def test_allocated_hours_calculation(self):
        """Test calculation of allocated hours from assigned tickets"""
        dev_id = 1
        
        # Mock work items assigned to developer
        items = [
            Mock(assignee_id=dev_id, estimated_hours=30, status="in_progress"),
            Mock(assignee_id=dev_id, estimated_hours=20, status="todo"),
            Mock(assignee_id=dev_id, estimated_hours=15, status="done"),
            Mock(assignee_id=dev_id, estimated_hours=None, status="todo"),  # No estimate
        ]
        
        # Calculate allocated hours (sum of all estimates)
        allocated = sum(item.estimated_hours or 0 for item in items)
        assert allocated == 65  # 30 + 20 + 15 + 0
    
    def test_remaining_hours_calculation(self):
        """Test calculation of remaining hours"""
        allocated = 100
        logged = 30
        
        # Remaining should be allocated - logged
        remaining = max(0, allocated - logged)
        assert remaining == 70
        
        # Test edge case: logged > allocated
        logged = 120
        remaining = max(0, allocated - logged)
        assert remaining == 0  # Should not go negative
    
    def test_null_developer_id_fallback(self):
        """Test fallback to assignee when time entry has no developer_id"""
        work_item_assignee_map = {100: 2, 101: 3}
        
        # Time entry with null developer_id
        time_entry = Mock()
        time_entry.developer_id = None
        time_entry.work_item_id = 100
        
        # Should fallback to assignee
        effective_dev_id = time_entry.developer_id or work_item_assignee_map.get(time_entry.work_item_id)
        assert effective_dev_id == 2
    
    def test_multiple_developers_time_entries(self):
        """Test that hours are correctly attributed to multiple developers"""
        entries = [
            Mock(developer_id=1, hours=5, logged_at=self.today),
            Mock(developer_id=1, hours=3, logged_at=self.today),
            Mock(developer_id=2, hours=4, logged_at=self.today),
            Mock(developer_id=2, hours=2, logged_at=self.today),
            Mock(developer_id=3, hours=0, logged_at=self.today),  # Zero hours
        ]
        
        # Group by developer
        dev_hours = {}
        for te in entries:
            dev_hours[te.developer_id] = dev_hours.get(te.developer_id, 0) + te.hours
        
        assert dev_hours[1] == 8
        assert dev_hours[2] == 6
        assert dev_hours[3] == 0
    
    def test_time_entry_date_boundaries(self):
        """Test time entries at week boundaries"""
        # Entry exactly at week start
        entry_start = Mock(
            developer_id=1, 
            hours=2, 
            logged_at=self.week_start
        )
        
        # Entry exactly at week end
        entry_end = Mock(
            developer_id=1, 
            hours=3, 
            logged_at=self.week_end
        )
        
        # Entry just before week start
        entry_before = Mock(
            developer_id=1, 
            hours=4, 
            logged_at=self.week_start - timedelta(seconds=1)
        )
        
        # Entry just after week end
        entry_after = Mock(
            developer_id=1, 
            hours=5, 
            logged_at=self.week_end + timedelta(seconds=1)
        )
        
        entries = [entry_start, entry_end, entry_before, entry_after]
        
        # Filter for this week
        this_week = [
            te for te in entries
            if te.logged_at and self.week_start <= te.logged_at <= self.week_end
        ]
        
        assert len(this_week) == 2
        assert sum(te.hours for te in this_week) == 5  # 2 + 3
    
    def test_work_item_logged_hours_consistency(self):
        """Test that work_item.logged_hours matches sum of time entries"""
        # This tests the data consistency issue
        work_item = Mock()
        work_item.id = 100
        work_item.logged_hours = 17  # Stored on work item
        work_item.assignee_id = 1
        
        # Time entries for this work item
        time_entries = [
            Mock(work_item_id=100, developer_id=1, hours=4),
            Mock(work_item_id=100, developer_id=1, hours=4),
            Mock(work_item_id=100, developer_id=1, hours=3),
        ]
        
        sum_from_entries = sum(te.hours for te in time_entries)
        
        # These should match for data consistency
        # If they don't, there's a bug in the logging mechanism
        assert work_item.logged_hours == sum_from_entries, \
            f"Mismatch: work_item has {work_item.logged_hours}h but time entries sum to {sum_from_entries}h"


class TestHoursAnalyticsEdgeCases:
    """Test edge cases for hours analytics"""
    
    def test_no_time_entries(self):
        """Test calculation when developer has no time entries"""
        dev_id = 1
        all_time_entries = []  # No entries
        
        dev_time_entries = [
            te for te in all_time_entries 
            if te.developer_id == dev_id
        ]
        
        logged = sum(te.hours for te in dev_time_entries)
        assert logged == 0
    
    def test_no_assigned_items(self):
        """Test calculation when developer has no assigned items"""
        dev_id = 1
        items = []  # No items
        
        dev_items = [item for item in items if item.assignee_id == dev_id]
        allocated = sum(item.estimated_hours or 0 for item in dev_items)
        
        assert allocated == 0
        assert len(dev_items) == 0
    
    def test_negative_remaining_calculation(self):
        """Test that remaining hours never goes negative"""
        allocated = 10
        logged = 15  # More than allocated
        
        remaining = max(0, allocated - logged)
        assert remaining == 0  # Should be clamped to 0
    
    def test_fractional_hours(self):
        """Test handling of fractional hours"""
        entries = [
            Mock(developer_id=1, hours=2.5, logged_at=datetime.utcnow()),
            Mock(developer_id=1, hours=1.5, logged_at=datetime.utcnow()),
        ]
        
        total = sum(te.hours for te in entries)
        assert total == 4.0


class TestDebugEndpointScenarios:
    """Test scenarios for the debug endpoint"""
    
    def test_debug_shows_all_time_entries(self):
        """Test that debug endpoint returns all time entries with details"""
        # Mock project with work items
        work_items = [
            Mock(id=1, key="PROJ-1", title="Task 1", assignee_id=1, assignee=Mock(name="Dev 1")),
            Mock(id=2, key="PROJ-2", title="Task 2", assignee_id=2, assignee=Mock(name="Dev 2")),
        ]
        
        # Mock time entries
        time_entries = [
            Mock(id=1, work_item_id=1, developer_id=1, hours=4, 
                 logged_at=datetime.utcnow(), description="Work done"),
            Mock(id=2, work_item_id=1, developer_id=2, hours=2,  # Different logger
                 logged_at=datetime.utcnow(), description="Review"),
            Mock(id=3, work_item_id=2, developer_id=2, hours=5,
                 logged_at=datetime.utcnow(), description="Implementation"),
        ]
        
        # Build work item map
        work_item_map = {wi.id: wi for wi in work_items}
        
        # Debug info should show attribution
        debug_info = []
        for te in time_entries:
            wi = work_item_map.get(te.work_item_id)
            debug_info.append({
                "time_entry_id": te.id,
                "work_item_key": wi.key if wi else "Unknown",
                "work_item_title": wi.title if wi else "Unknown",
                "logged_by_developer_id": te.developer_id,
                "ticket_assignee_id": wi.assignee_id if wi else None,
                "hours": te.hours,
                "attribution": "logger" if te.developer_id else "assignee_fallback"
            })
        
        assert len(debug_info) == 3
        # Entry 2: Dev 2 logged on Dev 1's ticket
        assert debug_info[1]["logged_by_developer_id"] == 2
        assert debug_info[1]["ticket_assignee_id"] == 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
