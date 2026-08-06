import React, { useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
    IconButton,
    Button,
    Chip,
    Divider,
} from '@mui/material';
import {
    Delete as DeleteIcon,
    DoneAll as MarkAllIcon,
    Circle as UnreadIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { notificationsActions } from '../../store/notifications';
import { PageHeader, EmptyState, LoadingSpinner } from '../../components/ui';
import { formatDate } from '../../utils/formatters';

const NotificationsPage: React.FC = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();

    const { list: notifications, unreadCount } = useSelector(
        (state: RootState) => state.notifications,
    );
    const loading = useSelector((state: RootState) =>
        state.http.loading.includes('GET_NOTIFICATIONS'),
    );

    useEffect(() => {
        dispatch(notificationsActions.getNotifications());
        dispatch(notificationsActions.getUnreadCount());
    }, [dispatch]);

    const handleMarkRead = (id: string) => {
        dispatch(notificationsActions.markRead(id));
    };

    const handleMarkAllRead = () => {
        dispatch(notificationsActions.markAllRead());
    };

    const handleDelete = (id: string) => {
        dispatch(notificationsActions.deleteNotification(id));
    };

    if (loading && notifications.length === 0) {
        return <LoadingSpinner fullPage />;
    }

    return (
        <Box>
            <PageHeader title={t('nav.notifications')}>
                {unreadCount > 0 && (
                    <Button
                        variant="outlined"
                        startIcon={<MarkAllIcon />}
                        onClick={handleMarkAllRead}
                    >
                        {t('notifications.markAllRead')}
                    </Button>
                )}
            </PageHeader>

            {unreadCount > 0 && (
                <Chip
                    label={`${unreadCount} ${t('notifications.unread')}`}
                    color="primary"
                    sx={{ mb: 2 }}
                />
            )}

            <Card>
                <CardContent sx={{ p: 0 }}>
                    {notifications.length === 0 ? (
                        <Box sx={{ p: 3 }}>
                            <EmptyState title={t('notifications.noNotifications')} />
                        </Box>
                    ) : (
                        <List disablePadding>
                            {notifications.map((notification, index) => (
                                <React.Fragment key={notification._id}>
                                    <ListItem
                                        sx={{
                                            py: 2,
                                            px: 3,
                                            backgroundColor: !notification.isRead
                                                ? 'action.hover'
                                                : 'transparent',
                                            cursor: !notification.isRead ? 'pointer' : 'default',
                                        }}
                                        onClick={() => {
                                            if (!notification.isRead) {
                                                handleMarkRead(notification._id);
                                            }
                                        }}
                                    >
                                        {!notification.isRead && (
                                            <UnreadIcon
                                                sx={{
                                                    fontSize: 10,
                                                    color: 'primary.main',
                                                    mr: 1.5,
                                                }}
                                            />
                                        )}
                                        <ListItemText
                                            primary={
                                                <Typography
                                                    variant="body1"
                                                    fontWeight={notification.isRead ? 400 : 600}
                                                >
                                                    {notification.title}
                                                </Typography>
                                            }
                                            secondary={
                                                <Box>
                                                    <Typography
                                                        variant="body2"
                                                        color="text.secondary"
                                                    >
                                                        {notification.message}
                                                    </Typography>
                                                    <Typography
                                                        variant="caption"
                                                        color="text.disabled"
                                                        sx={{ mt: 0.5, display: 'block' }}
                                                    >
                                                        {formatDate(notification.createdAt, 'dd.MM.yyyy HH:mm')}
                                                    </Typography>
                                                </Box>
                                            }
                                        />
                                        <ListItemSecondaryAction>
                                            <IconButton
                                                size="small"
                                                color="error"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDelete(notification._id);
                                                }}
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </ListItemSecondaryAction>
                                    </ListItem>
                                    {index < notifications.length - 1 && <Divider />}
                                </React.Fragment>
                            ))}
                        </List>
                    )}
                </CardContent>
            </Card>
        </Box>
    );
};

export default NotificationsPage;
