"use client";

import { LucideIcon } from 'lucide-react';
import { Card, Flex, Typography, theme, ConfigProvider } from 'antd';
import type { CSSProperties } from 'react';

const { Text } = Typography;
const { useToken } = theme;

interface StatCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    color: 'blue' | 'green' | 'purple' | 'red' | 'gray' | 'amber';
    subValue?: string;
}

const colorConfig = {
    blue: { bg: '#eff6ff', text: '#2563eb' },
    green: { bg: '#ecfdf5', text: '#059669' },
    purple: { bg: '#faf5ff', text: '#9333ea' },
    red: { bg: '#fef2f2', text: '#dc2626' },
    gray: { bg: '#f9fafb', text: '#6b7280' },
    amber: { bg: '#fffbeb', text: '#d97706' }
};

export function StatCard({ title, value, icon: Icon, color, subValue }: StatCardProps) {
    const { token } = useToken();
    const colorScheme = colorConfig[color];

    return (
        <ConfigProvider
            theme={{
                components: {
                    Card: {
                        borderRadiusLG: token.borderRadiusLG,
                    }
                }
            }}
        >
            <Card
                bordered
                hoverable
                styles={{
                    body: {
                        padding: `${token.paddingSM}px`
                    }
                }}
            >
                <Flex vertical gap="small">
                    <Flex justify="flex-start" align="flex-start">
                        <ConfigProvider
                            theme={{
                                token: {
                                    borderRadiusLG: token.borderRadiusLG,
                                    colorBgContainer: colorScheme.bg,
                                    padding: token.paddingSM
                                }
                            }}
                        >
                            <Flex
                                align="center"
                                justify="center"
                                style={{
                                    borderRadius: token.borderRadiusLG,
                                    backgroundColor: colorScheme.bg,
                                    padding: token.paddingSM,
                                    width: 'fit-content'
                                }}
                            >
                                <Icon
                                    size={20}
                                    color={colorScheme.text}
                                />
                            </Flex>
                        </ConfigProvider>
                    </Flex>

                    <Flex vertical gap="none">
                        <Typography.Title
                            level={2}
                            style={{
                                margin: 0,
                                fontSize: token.fontSizeHeading3,
                                fontWeight: 900,
                                lineHeight: 1.2
                            }}
                            ellipsis
                        >
                            {value}
                        </Typography.Title>

                        <Text
                            type="secondary"
                            strong
                            style={{
                                fontSize: token.fontSizeSM,
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                display: 'block',
                                marginTop: token.marginXXS
                            }}
                        >
                            {title}
                        </Text>

                        {subValue && (
                            <Text
                                type="secondary"
                                style={{
                                    fontSize: token.fontSizeSM,
                                    display: 'block',
                                    marginTop: token.marginXS
                                }}
                                ellipsis
                            >
                                {subValue}
                            </Text>
                        )}
                    </Flex>
                </Flex>
            </Card>
        </ConfigProvider>
    );
}
