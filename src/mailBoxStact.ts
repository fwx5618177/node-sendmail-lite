import { PendingCallback, ErrorCallback } from "./ExecList";

/**
 * 要执行的邮箱堆栈列表
 */
export class MailBoxStackList {
    public isEnd: boolean = false; // 是否已经终止
    public isRunning: boolean = false; // 任务是否正在运行, 还没有调用参数上的next()

    public funcs: PendingCallback[] = [];
    public catchFunc: ErrorCallback | null = null; // 用于捕捉错误的回调函数

    /**
     * 调用多次next(err) 会触发多次catch
     * @param callback 
     */
    public catch(callback: ErrorCallback) {
        this.catchFunc = callback;
    }

    /**
     * 等待压栈
     * @param callback 
     * @returns {this} class MailBoxStackList
     */
    public pending(callback: PendingCallback) {
        this.funcs.push(callback);

        return this;
    }

    /**
     * 关闭
     */
    public terminated() {
        this.isEnd = true;
    }

    /**
     * 在执行任务未完成前不会执行下一个任务，在任务链中有一个任务出错，剩余任务不会再执行
     * @param args 
     */
    public exec(...args: any[]) {
        const thisObj = this;
        const func = this.funcs.shift(); // 队列中第一个任务

        if (thisObj.isEnd) throw new Error('already closed.');

        if(thisObj.isRunning) throw new Error('Current task not be called.');

        if (!!func) {
            // 当前任务完成前，不得进行下一次任务
            thisObj.isRunning = true;

            // 作为任务的最后一个参数，用来确定任务是否成功完成
            args[args.length] = (err: Error) => {
                thisObj.isRunning = false;

                if (err) {
                    thisObj.isEnd = true;
                    if (thisObj.catchFunc) {
                        thisObj.catchFunc(err);
                    }
                }

            }

            func.apply(thisObj, args as any)
        }
    }

}