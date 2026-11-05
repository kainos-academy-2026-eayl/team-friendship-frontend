import { type Request, type Response, Router } from 'express';
import { getOrderHistory } from '../services/orderHistoryService';
import orderHistoryPage from '../views/pages/order_history/order_history';
import { backendUrl } from './sessionController';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
    const customerID = Number(req.cookies.customerID);


    if (!customerID) {
        res.redirect('/login');
        return;
    }

    const result = await getOrderHistory(
        backendUrl(),
        res.locals.accessToken,
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
