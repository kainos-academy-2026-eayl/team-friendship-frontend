import { type Request, type Response, Router } from 'express';
import { getOrderHistory } from '../services/orderHistoryService';
import orderHistoryPage from '../views/pages/order_history/order_history';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
    const customerID = Number(req.query.customerID);

    if (Number.isNaN(customerID)) {
        res.render('order_history/order_history', {
            page: {
                ...orderHistoryPage,
                orders: [],
            },
            error: 'Invalid customer id.',
        });
        return;
    }

    const result = await getOrderHistory(
        process.env.BACKEND_URL ?? 'http://localhost:3000',
        customerID,
    );

    if (!result.ok) {
        res.render('order_history/order_history', {
            page: {
                ...orderHistoryPage,
                orders: [],
            },
            error: result.message,
        });
        return;
    }

    res.render('order_history/order_history', {
        page: {
            ...orderHistoryPage,
            orders: result.orders,
        },
    });
});

export default router;
