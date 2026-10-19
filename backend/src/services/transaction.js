async function withTransaction(pool, work) {
    const promisePool = typeof pool.promise === 'function' ? pool.promise() : pool;
    const connection = await promisePool.getConnection();
    let reusable = true;
    try {
        await connection.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
        await connection.beginTransaction();
        const result = await work(connection);
        await connection.commit();
        return result;
    } catch (error) {
        try { await connection.rollback(); }
        catch { reusable = false; connection.destroy(); }
        throw error;
    } finally { if (reusable) connection.release(); }
}
module.exports = { withTransaction };
