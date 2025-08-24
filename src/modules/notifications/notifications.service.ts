import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotificationDocument } from './schemas/notification.schema';
import { UsersService } from '../users/users.service';

type NotifyInput = {
  userId: string;
  merchantId?: string;
  type: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  severity?: 'info'|'success'|'warning'|'error';
};

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name) private notifModel: Model<NotificationDocument>,
    private readonly users: UsersService,
  ) {}

  async notifyUser(userId: string, input: Omit<NotifyInput, 'userId'> & { userId?: string }) {
    const uid = new Types.ObjectId(userId ?? input.userId!);
    // 1) اقرأ تفضيلات المستخدم (channels/topics/quietHours)
    const prefs = await this.users.getNotificationsPrefs(uid.toString()).catch(()=>null);

    // 2) تحقق من quiet hours (تجاوز بسيط)
    //     (تبسيط: لا نرسل عبر البريد إن كانت quietHours مفعلة؛ نرسل داخل التطبيق دائماً)
    const inAppEnabled = prefs?.channels?.inApp !== false;
    const emailEnabled = prefs?.channels?.email === true;

    // 3) أنشئ In-App دائمًا
    const doc = await this.notifModel.create({
      userId: uid,
      merchantId: input.merchantId ? new Types.ObjectId(input.merchantId) : undefined,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data,
      severity: input.severity ?? 'info',
    });

    // (اختياري) ادفع WebSocket لإشعار فوري في الواجهة
    // this.gateway?.emitToUser(uid, { ...doc.toJSON() });

    // 4) بريد (اختياري)
    if (emailEnabled) {
      // استخدم MailService عندك لإرسال رسالة بسيطة
      // await this.mail.send(userEmail, input.title, input.body ?? '');
    }

    return doc;
  }

  async listForUser(userId: string, { page=1, limit=20, unreadOnly=false } = {}) {
    const q: any = { userId: new Types.ObjectId(userId) };
    if (unreadOnly) q.read = false;
    const docs = await this.notifModel
      .find(q).sort({ createdAt: -1 })
      .skip((page-1)*limit).limit(limit).lean();
    const total = await this.notifModel.countDocuments(q);
    return { items: docs, total, page, limit };
  }

  async markRead(userId: string, notifId: string) {
    await this.notifModel.updateOne(
      { _id: notifId, userId: new Types.ObjectId(userId) },
      { $set: { read: true, readAt: new Date() } }
    );
    return { ok: true };
  }

  async markAllRead(userId: string) {
    await this.notifModel.updateMany(
      { userId: new Types.ObjectId(userId), read: false },
      { $set: { read: true, readAt: new Date() } }
    );
    return { ok: true };
  }
}
