"""
Task Queue — Simple async task queue for background processing.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any

logger = logging.getLogger(__name__)


class TaskStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class Task:
    """A background processing task."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    document_id: str = ""
    status: TaskStatus = TaskStatus.PENDING
    stage: str = ""
    progress: float = 0.0
    error: str = ""
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: datetime | None = None


class TaskQueue:
    """
    Async task queue for document processing.
    Maintains a queue and a registry of active/completed tasks.
    """

    def __init__(self, max_concurrent: int = 2):
        self._queue: asyncio.Queue[Task] = asyncio.Queue()
        self._tasks: dict[str, Task] = {}
        self._max_concurrent = max_concurrent
        self._active_count = 0

    def enqueue(self, document_id: str) -> Task:
        """Add a document processing task to the queue."""
        task = Task(document_id=document_id)
        self._tasks[task.id] = task
        self._queue.put_nowait(task)
        logger.info(f"Queued task {task.id} for document {document_id}")
        return task

    async def dequeue(self) -> Task:
        """Get the next task from the queue (blocks until available)."""
        task = await self._queue.get()
        task.status = TaskStatus.PROCESSING
        self._active_count += 1
        return task

    def complete(self, task_id: str) -> None:
        """Mark a task as completed."""
        if task_id in self._tasks:
            self._tasks[task_id].status = TaskStatus.COMPLETED
            self._tasks[task_id].progress = 1.0
            self._tasks[task_id].completed_at = datetime.now(timezone.utc)
            self._active_count = max(0, self._active_count - 1)

    def fail(self, task_id: str, error: str) -> None:
        """Mark a task as failed."""
        if task_id in self._tasks:
            self._tasks[task_id].status = TaskStatus.FAILED
            self._tasks[task_id].error = error
            self._tasks[task_id].completed_at = datetime.now(timezone.utc)
            self._active_count = max(0, self._active_count - 1)

    def update_progress(self, task_id: str, stage: str, progress: float) -> None:
        """Update task progress."""
        if task_id in self._tasks:
            self._tasks[task_id].stage = stage
            self._tasks[task_id].progress = progress

    def get_task(self, task_id: str) -> Task | None:
        """Get task by ID."""
        return self._tasks.get(task_id)

    def get_task_by_document(self, document_id: str) -> Task | None:
        """Get the latest task for a document."""
        for task in reversed(list(self._tasks.values())):
            if task.document_id == document_id:
                return task
        return None

    @property
    def pending_count(self) -> int:
        return self._queue.qsize()

    @property
    def active_count(self) -> int:
        return self._active_count

    @property
    def is_empty(self) -> bool:
        return self._queue.empty()


# Singleton
_task_queue: TaskQueue | None = None


def get_task_queue() -> TaskQueue:
    """Get the task queue singleton."""
    global _task_queue
    if _task_queue is None:
        _task_queue = TaskQueue()
    return _task_queue
