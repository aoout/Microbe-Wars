
import { TutorialStep } from '../types';

export const TUTORIAL_STEPS: TutorialStep[] = [
    { 
      id: 0, 
      text: "指挥官，系统已上线。当前环境：培养皿 Alpha。未激活的背景节点已过滤。专注执行核心指令。", 
      requiredAction: 'NEXT' 
    },
    { 
      id: 1, 
      text: "指令一：建立突触链接。点击选中你的 **母体群落** (蓝色节点)。", 
      requiredAction: 'SELECT', 
      targetNodeId: 'tutorial-player' 
    },
    { 
      id: 2, 
      text: "我们需要生物质来增殖。点击上方的 **中立群落** (灰色)，派遣孢子进行感染。", 
      requiredAction: 'ATTACK', 
      targetNodeId: 'tutorial-neutral' 
    },
    { 
      id: 3, 
      text: "孢子正在突破细胞壁。等待群落完成 **同化**。中立目标是极佳的初期资源。", 
      requiredAction: 'CAPTURE', 
      targetNodeId: 'tutorial-neutral' 
    },
    { 
      id: 4, 
      text: "【生长算法】群落越大，细胞分裂速率越高。尽早扩张以获得指数级资源优势。", 
      requiredAction: 'NEXT' 
    },
    { 
      id: 5, 
      text: "【环境警告】培养基极不稳定。注意图中的 **虚线连接**。每 60 秒，洋流会随机重组这些路径。", 
      requiredAction: 'NEXT' 
    },
    { 
      id: 6, 
      text: "只有 **实线连接** 是永久固定的神经突触。利用它们构建不可动摇的防线。", 
      requiredAction: 'NEXT' 
    },
    { 
      id: 7, 
      text: "【高级战术】按住 **[Ctrl] + 点击** (或长按拖拽) 目标，建立 **持续输送流**。尝试建立补给线。", 
      requiredAction: 'STREAM', 
      targetNodeId: 'tutorial-neutral' 
    },
    { 
      id: 8, 
      text: "高危警报：侦测到敌对红色菌株！运用你所学的一切战术，**彻底根除它**。", 
      requiredAction: 'WIN', 
      targetNodeId: 'tutorial-enemy' 
    }
];
