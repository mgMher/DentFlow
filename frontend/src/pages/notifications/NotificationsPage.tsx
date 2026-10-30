import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Card,
    Divider,
    IconButton,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    Tab,
    TablePagination,
    Tabs,
    Tooltip,
    Typography,
} from '@mui/material';
import {
    Delete as DeleteIcon,
    DeleteSweep as DeleteReadIcon,
    DoneAll as MarkAllIcon,
    Circle as UnreadIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { notificationsActions, NotificationsQuery } from '../../store/notifications';
import { ConfirmDialog, EmptyState, LoadingSpinner, PageHeader } from '../../components/ui';
import { useHttpState } from '../../hooks';
import { formatDateTime } from '../../utils/formatters';
import { notificationLink, notificationText } from '../../utils/notifications';
import { Notification } from '../../types';

const PAGE_SIZE = 20;

type Confirm = { kind: 'one'; notification: Notification } | { kind: 'read' } | null;

const NotificationsPage: React.FC = () => {
    const { t, i18n } = useTranslation();
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const { list, total, unreadCount } = useSelector((state: RootState) => state.notifications);
    const { loading, error } = useHttpState('GET_NOTIFICATIONS');
    const [tab, setTab] = useState<'all' | 'unread'>('all');
    const [page, setPage] = useState(0);
    const [confirm, setConfirm] = useState<Confirm>(null);

    const query: NotificationsQuery = useMemo(
        () => ({ page: page + 1, limit: PAGE_SIZE, ...(tab === 'unread' ? { isRead: false } : {}) }),
        [page, tab],
    );

    useEffect(() => {
        dispatch(notificationsActions.getNotifications(query));
    }, [dispatch, query]);

    // Deleting the last item of the last page leaves an empty page behind: step back.
    useEffect(() => {
        if (!loading && page > 0 && list.length === 0 && total > 0) setPage(Math.ceil(total / PAGE_SIZE) - 1);
    }, [loading, page, list.length, total]);

    const open = (notification: Notification) => {
        if (!notification.isRead) dispatch(notificationsActions.markRead(notification._id));
        const link = notificationLink(notification);
        if (link) navigate(link);
    };

    const confirmDelete = () => {
        if (confirm?.kind === 'one') dispatch(notificationsActions.deleteNotification(confirm.notification._id));
        if (confirm?.kind === 'read') dispatch(notificationsActions.deleteRead());
        setConfirm(null);
    };

    const readOnPage = list.some((n) => n.isRead);

    return (
        <Box>
            <PageHeader title={t('nav.notifications')}>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {unreadCount > 0 && (
                        <Button variant="outlined" startIcon={<MarkAllIcon />} onClick={() => dispatch(notificationsActions.markAllRead())}>
                            {t('notifications.markAllRead')}
                        </Button>
                    )}
                    {tab === 'all' && readOnPage && (
                        <Button color="inherit" startIcon={<DeleteReadIcon />} onClick={() => setConfirm({ kind: 'read' })}>
                            {t('notifications.deleteRead')}
                        </Button>
                    )}
                </Box>
            </PageHeader>

            <Tabs
                value={tab}
                onChange={(_, v) => {
                    setTab(v);
                    setPage(0);
                }}
                sx={{ mb: 2 }}
            >
                <Tab value="all" label={t('notifications.all')} />
                <Tab value="unread" label={`${t('notifications.unreadTab')}${unreadCount ? ` (${unreadCount})` : ''}`} />
            </Tabs>

            {error && (
                <Alert
                    severity="error"
                    sx={{ mb: 2 }}
                    action={
                        <Button color="inherit" size="small" onClick={() => dispatch(notificationsActions.getNotifications(query))}>
                            {t('common.retry')}
                        </Button>
                    }
                >
                    {error}
                </Alert>
            )}

            <Card>
                {loading && list.length === 0 ? (
                    <LoadingSpinner />
                ) : list.length === 0 ? (
                    <Box sx={{ p: 3 }}>
                        <EmptyState title={t(tab === 'unread' ? 'notifications.noUnread' : 'notifications.noNotifications')} />
                    </Box>
                ) : (
                    <>
                        <List disablePadding>
                            {list.map((notification, index) => {
                                const { title, message } = notificationText(notification, t, i18n.language);
                                return (
                                    <React.Fragment key={notification._id}>
                                        {index > 0 && <Divider component="li" />}
                                        <ListItem
                                            disablePadding
                                            secondaryAction={
                                                <Tooltip title={t('common.delete')}>
                                                    <IconButton
                                                        edge="end"
                                                        size="small"
                                                        aria-label={t('common.delete')}
                                                        onClick={() => setConfirm({ kind: 'one', notification })}
                                                    >
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            }
                                            sx={{ bgcolor: notification.isRead ? 'transparent' : 'action.hover' }}
                                        >
                                            <ListItemButton onClick={() => open(notification)} sx={{ py: 1.5, pl: 2, pr: 7, alignItems: 'flex-start' }}>
                                                <Box sx={{ width: 20, pt: 0.75, flexShrink: 0 }}>
                                                    {!notification.isRead && (
                                                        <UnreadIcon sx={{ fontSize: 10, color: 'primary.main' }} aria-label={t('notifications.unreadTab')} />
                                                    )}
                                                </Box>
                                                <ListItemText
                                                    primary={
                                                        <Typography variant="body1" fontWeight={notification.isRead ? 400 : 600}>
                                                            {title}
                                                        </Typography>
                                                    }
                                                    secondary={
                                                        <>
                                                            <Typography component="span" variant="body2" color="text.secondary" sx={{ display: 'block' }}>
                                                                {message}
                                                            </Typography>
                                                            <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                                                {notification.actorId
                                                                    ? `${notification.actorId.firstName} ${notification.actorId.lastName} · `
                                                                    : ''}
                                                                {formatDateTime(notification.createdAt, i18n.language)}
                                                            </Typography>
                                                        </>
                                                    }
                                                />
                                            </ListItemButton>
                                        </ListItem>
                                    </React.Fragment>
                                );
                            })}
                        </List>
                        {total > PAGE_SIZE && (
                            <TablePagination
                                component="div"
                                count={total}
                                page={page}
                                onPageChange={(_, p) => setPage(p)}
                                rowsPerPage={PAGE_SIZE}
                                rowsPerPageOptions={[PAGE_SIZE]}
                            />
                        )}
                    </>
                )}
            </Card>

            <ConfirmDialog
                open={!!confirm}
                title={t(confirm?.kind === 'read' ? 'notifications.deleteReadTitle' : 'notifications.deleteTitle')}
                message={t(confirm?.kind === 'read' ? 'notifications.deleteReadMessage' : 'notifications.deleteMessage')}
                confirmLabel={t('common.delete')}
                variant="danger"
                onConfirm={confirmDelete}
                onCancel={() => setConfirm(null)}
            />
        </Box>
    );
};

export default NotificationsPage;
