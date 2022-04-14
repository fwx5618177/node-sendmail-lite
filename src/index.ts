import * as dns from 'dns';
import * as net from 'net';
import * as readline from 'readline';
import * as createDebug from 'debug';
import { base64_encode, toInt } from './lib/lib';
import { MailBoxStackList } from './mailBoxStact';

const debug = createDebug('zengming:sendmail');

/**
 * dns 查询收件地址
 * @param receiveHost 收件地址
 */
const queryDNSAddress = (receiveHost: string): string => {
    let addr;
    
    new Promise((resolve, reject) => {
        dns.resolveMx(receiveHost, (err, addrs) => {
            const tmpAddr = addrs[0] && addrs[0].exchange;
    
            console.log('addr:', addrs[0], addrs[0].exchange);
    
            if (err) throw new Error('resolveMx error:' + err);

            resolve(tmpAddr as string)
        })
    }).then((addrs) => {
        if (!addrs) throw new Error('resolveMx error, addr:' + addrs);

        addr = addrs
    })

    

    return addr as any;
}

/**
 * 建立连接
 * @param port 端口
 * @param address 地址
 */
const querySocket = (port: number = 25, address: string): net.Socket => {
    const socket = net.connect(port, address);

    socket.setEncoding('utf8');

    return socket;
}

/**
 * 超时提醒
 * @param socket 
 * @param MailBoxStackList 
 */
const connectTimeout = (socket: net.Socket, MailBoxStackList: MailBoxStackList) => {
    socket.setTimeout(1000 * 10, () => {
        MailBoxStackList.terminated();
        socket.destroy();

        throw new Error('timeout');
    })
}

/**
 * 监听错误
 * @param socket 
 * @param MailBoxStackList 
 */
const socketErr = (socket: net.Socket, MailBoxStackList: MailBoxStackList) => {
    socket.on('error', err => {
        MailBoxStackList.terminated();

        throw new Error('socketErr:' + err);
    })
}

/**
 * 设置协议栈
 * @param execList 
 */
const protocolSetting = (socket: net.Socket, execList: MailBoxStackList, mailSet:{
    $senderName: string, $sender: string, $to: string, $subject: string, $content: string, callback: (err: Error | null) => void
}) => {
    const { $senderName, $sender, $to, $subject, $content, callback } = mailSet

    execList.pending(function (line, next) {
        debug(line);
        if (toInt(line) !== 220) {
          next(new Error(line));
        } else {
          const senderHost = $sender.substr($sender.indexOf('@') + 1);
          socket.write('HELO ' + senderHost + '\r\n');
          next();
        }
      }).pending(function (line, next) {
        debug(line);
        if (toInt(line) !== 250) {
          next(new Error(line));
        } else {
          socket.write('MAIL FROM: <' + $sender + '>\r\n');
          next();
        }
      }).pending(function (line, next) {
        debug(line);
        if (toInt(line) !== 250) {
          next(new Error(line));
        } else {
          socket.write('RCPT TO: <' + $to + '>\r\n');
          next();
        }
      }).pending(function (line, next) {
        debug(line);
        if (toInt(line) !== 250) {
          next(new Error(line));
        } else {
          socket.write('DATA\r\n');
          next();
        }
      }).pending(function (line, next) {
        console.log('line:', line, toInt(line));
        
        // debug(line);
        if (toInt(line) !== 354) {
          next(new Error(line));
        } else {
          socket.write('From: =?utf8?B?' + base64_encode($senderName) + '?= <' + $sender + '>\r\n');
          socket.write('To: ' + $to + '\r\n');
          socket.write('Subject: =?utf8?B?' + base64_encode($subject) + '?=\r\n');
          socket.write('Date: ' + new Date() + '\r\n');
          socket.write('MIME-Version: 1.0\r\n');
          socket.write('Content-Type: text/html; charset=\'utf8\'\r\n');
          socket.write('Content-Transfer-Encoding: base64\r\n');
          socket.write('X-Priority: 3\r\n');
          socket.write('X-Mailer: Node.js Mail Sender\r\n');
          socket.write('\r\n');
          socket.write(base64_encode($content));
          socket.write('\r\n.\r\n');
          next();
        }
      }).pending(function (line, next) {
        debug(line);
        if (toInt(line) === 550) {
          next(new Error('Mail is intercepted: ' + line));
        } else if (toInt(line) !== 250) {
          next(new Error(line));
        } else {
          socket.write('QUIT\r\n');
          next();
        }
      }).pending(function (line, next) {
        debug(line);
        if (toInt(line) !== 221) {
          next(new Error(line));
        } else {
          socket.end();
          // 完成
          callback(null);
        }
      }).catch(function (err) {
        execList.terminated();
        socket.end();
        callback(err);
      });
}


/**
 * 发送utf8格式的html邮件
 * @param senderName   发送者名字
 * @param sender       发送者地址
 * @param to           收件人地址
 * @param subject      邮件标题
 * @param content      邮件内容（只支持html）
 * @param cb  function(err) 成功则不带参数，失败带一个err参数
 */
const sendMail = ($senderName: string, $sender: string, $to: string, $subject: string, $content: string, callback: (err: Error | null) => void) => {
    const execList = new MailBoxStackList();
    const $toHostname = $to.substr($to.indexOf('@') + 1);


    const socket = querySocket(25, queryDNSAddress($toHostname));

    connectTimeout(socket, execList);
    socketErr(socket, execList);

    protocolSetting(socket, execList, {
        $senderName,
        $sender,
        $to, $subject, $content, callback
    })

    const rl = readline.createInterface({ input: socket });

    rl.on('line', line => {
        execList.exec(line);
    })
}

export default sendMail