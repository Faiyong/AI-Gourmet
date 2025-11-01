#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
美食笔记搜索 - Flask后端API
解决前端CORS跨域问题
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import logging
import time
import sqlite3
import os

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # 允许所有来源的跨域请求

# 请求头模拟真实浏览器
def get_headers(referer='https://www.douguo.com/', site='douguo'):
    """
    生成请求头，每次调用返回新的headers
    
    参数:
    - referer: 来源页面URL
    - site: 目标网站类型 ('baidu' 或 'douguo')
    """
    # 百度搜索不能使用br压缩，会导致乱码
    # 豆果美食可以使用br压缩
    accept_encoding = 'gzip, deflate' if site == 'baidu' else 'gzip, deflate, br'
    
    return {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': accept_encoding,
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"macOS"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Referer': referer,
        'DNT': '1',
    }

@app.route('/')
def index():
    """API首页"""
    return jsonify({
        'status': 'ok',
        'message': '美食笔记搜索API服务正在运行',
        'endpoints': {
            '/api/search-notes': '搜索美食笔记',
            '/api/health': '健康检查'
        }
    })

@app.route('/api/health')
def health():
    """健康检查接口"""
    return jsonify({'status': 'healthy', 'service': '美食笔记搜索API'})

@app.route('/api/geocode', methods=['GET'])
def geocode():
    """
    逆地理编码接口（经纬度 → 详细地址）
    使用高德地图API
    
    参数：
    - lat: 纬度
    - lon: 经度
    
    返回：JSON格式的详细地址信息
    """
    try:
        lat = request.args.get('lat', '').strip()
        lon = request.args.get('lon', '').strip()
        
        if not lat or not lon:
            return jsonify({'status': -1, 'message': '缺少经纬度参数'}), 400
        
        # 使用高德地图逆地理编码API（国内服务，稳定快速）
        # 注意：需要申请高德地图Web服务API key
        # 可以在 https://console.amap.com/ 免费申请，每天配额充足
        amap_key = 'a9e44f7c387c1b48ac79da8e40fc716f'  # 这是一个示例key，建议替换为自己的
        api_url = f'https://restapi.amap.com/v3/geocode/regeo?key={amap_key}&location={lon},{lat}&extensions=all&output=json'
        
        logger.info(f"请求高德逆地理编码API: lat={lat}, lon={lon}")
        
        response = requests.get(api_url, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        logger.info(f"逆地理编码原始响应: status={data.get('status')}, info={data.get('info')}")
        
        if data.get('status') == '1' and data.get('regeocode'):
            regeocode = data['regeocode']
            formatted_address = regeocode.get('formatted_address', '')
            addressComponent = regeocode.get('addressComponent', {})
            
            # 提取地址组件
            province = addressComponent.get('province', '')
            city = addressComponent.get('city', '') or addressComponent.get('province', '')  # 直辖市的city为[]
            district = addressComponent.get('district', '')
            township = addressComponent.get('township', '')
            street = addressComponent.get('streetNumber', {}).get('street', '')
            number = addressComponent.get('streetNumber', {}).get('number', '')
            
            # 构建详细地址
            if not formatted_address:
                formatted_address = f"{province}{city}{district}{township}{street}{number}"
            
            result = {
                'status': 0,
                'message': 'success',
                'content': {
                    'address': formatted_address,
                    'address_detail': {
                        'province': province,
                        'city': city,
                        'district': district,
                        'street': township,
                        'streetNumber': f"{street}{number}",
                    },
                    'point': {
                        'x': lon,
                        'y': lat
                    }
                },
                'source': 'gps+amap'
            }
            logger.info(f"✅ 逆地理编码成功: {formatted_address}")
            return jsonify(result), 200
        else:
            error_msg = data.get('info', '逆地理编码失败')
            logger.error(f"逆地理编码失败: status={data.get('status')}, info={error_msg}")
            return jsonify({'status': -1, 'message': error_msg}), 400
            
    except Exception as e:
        logger.error(f"逆地理编码错误: {str(e)}")
        return jsonify({'status': -1, 'message': f'服务器错误: {str(e)}'}), 500

@app.route('/api/ip-location', methods=['GET'])
def ip_location():
    """
    IP定位代理接口（使用 ip-api.com，免费且稳定）
    
    返回：JSON格式的位置信息
    """
    try:
        # 使用 ip-api.com 免费服务（每分钟45次请求限制）
        # lang=zh-CN 参数确保返回中文地名
        api_url = 'http://ip-api.com/json/?lang=zh-CN&fields=status,message,country,regionName,city,district,lat,lon,query'
        
        logger.info(f"请求IP定位API: {api_url}")
        
        # 发起请求
        response = requests.get(
            api_url,
            timeout=10,
            headers={
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'application/json',
            }
        )
        
        response.raise_for_status()
        data = response.json()
        
        logger.info(f"IP定位原始响应: {data}")
        
        if data.get('status') == 'success':
            province = data.get('regionName', '')
            city = data.get('city', '')
            district = data.get('district', '')
            
            # 处理地名：优先使用省份，如果城市是英文则忽略
            # 检查城市名是否包含中文字符
            import re
            has_chinese = bool(re.search(r'[\u4e00-\u9fff]', city))
            
            # 如果城市名是纯英文，只显示省份
            if not has_chinese and province:
                display_city = province
                display_address = province
            elif city and has_chinese:
                display_city = city
                display_address = f"{province} {city}".strip()
            else:
                display_city = province or '未知'
                display_address = province or '未知'
            
            logger.info(f"地名处理: province={province}, city={city}, has_chinese={has_chinese}, display={display_address}")
            
            # 转换为统一格式
            result = {
                'status': 0,
                'message': 'success',
                'content': {
                    'address': display_address,
                    'address_detail': {
                        'province': province,
                        'city': display_city,
                        'district': district,
                        'city_code': '',
                    },
                    'point': {
                        'x': str(data.get('lon', '')),
                        'y': str(data.get('lat', ''))
                    }
                },
                'ip': data.get('query', ''),
                'source': 'ip-api.com'
            }
            logger.info(f"✅ 定位成功: {result['content']['address']}")
            return jsonify(result), 200
        else:
            error_msg = data.get('message', '定位失败')
            logger.error(f"IP定位失败: {error_msg}")
            return jsonify({'status': -1, 'message': error_msg}), 400
        
    except requests.Timeout:
        logger.error("IP定位请求超时")
        return jsonify({'status': -1, 'message': '请求超时'}), 504
        
    except requests.RequestException as e:
        logger.error(f"IP定位请求失败: {str(e)}")
        return jsonify({'status': -1, 'message': f'请求失败: {str(e)}'}), 500
        
    except Exception as e:
        logger.error(f"IP定位未知错误: {str(e)}")
        return jsonify({'status': -1, 'message': f'服务器错误: {str(e)}'}), 500

@app.route('/api/search-notes', methods=['GET'])
def search_notes():
    """
    搜索美食笔记接口
    
    参数：
    - query: 搜索关键词（必填）
    - page: 页码，默认1
    
    返回：百度搜索结果的HTML
    """
    try:
        # 获取请求参数
        query = request.args.get('query', '').strip()
        page = int(request.args.get('page', 1))
        
        if not query:
            return jsonify({'error': '搜索关键词不能为空'}), 400
        
        # 构建百度搜索URL
        # pd=note 参数用于搜索笔记类内容
        # pn 参数用于分页，每页10条结果
        baidu_url = f"https://www.baidu.com/s?wd={query}&pd=note&rpf=pc&pn={(page-1)*10}"
        
        logger.info(f"搜索请求: query={query}, page={page}")
        logger.info(f"百度URL: {baidu_url}")
        
        # 创建session以支持cookie
        session = requests.Session()
        
        # 发起请求
        # requests会自动处理gzip解压和编码
        response = session.get(
            baidu_url,
            headers=get_headers('https://www.baidu.com/', 'baidu'),
            timeout=10,
            allow_redirects=True
        )
        
        # 检查响应状态
        response.raise_for_status()
        
        # 让requests自动处理解码
        # response.text会：1) 自动解压gzip  2) 根据Content-Type自动解码
        text_content = response.text
        
        logger.info(f"请求成功: status={response.status_code}, encoding={response.encoding}, length={len(text_content)} 字符")
        
        # 检测是否触发安全验证
        if '百度安全验证' in text_content or 'mkdjump' in text_content:
            logger.warning("⚠️ 触发百度安全验证")
            return jsonify({
                'error': '触发百度安全验证',
                'message': '百度检测到自动化请求，请稍后重试',
                'tips': [
                    '这是百度的反爬虫机制，属于正常现象',
                    '请等待1-2分钟后重试',
                    '或者直接在浏览器中访问百度搜索'
                ]
            }), 403
        
        # 返回HTML内容（移除包含中文的自定义响应头，避免编码错误）
        return text_content, 200, {
            'Content-Type': 'text/html; charset=utf-8'
        }
        
    except requests.Timeout:
        logger.error("请求超时")
        return jsonify({'error': '请求超时，请稍后重试'}), 504
        
    except requests.RequestException as e:
        logger.error(f"请求失败: {str(e)}")
        return jsonify({'error': f'请求失败: {str(e)}'}), 500
        
    except ValueError as e:
        logger.error(f"参数错误: {str(e)}")
        return jsonify({'error': '页码参数必须是数字'}), 400
        
    except Exception as e:
        logger.error(f"未知错误: {str(e)}")
        return jsonify({'error': f'服务器错误: {str(e)}'}), 500

@app.route('/api/search-recipes', methods=['GET'])
def search_recipes():
    """
    搜索豆果美食菜谱接口
    
    参数：
    - query: 搜索关键词（必填）
    - page: 页码，默认1
    
    返回：豆果美食搜索结果的HTML
    """
    try:
        query = request.args.get('query', '').strip()
        page = int(request.args.get('page', 1))
        
        if not query:
            return jsonify({'error': '搜索关键词不能为空'}), 400
        
        # 豆果美食搜索URL - 使用caipu搜索而不是search/recipe
        # 格式：https://www.douguo.com/caipu/关键词
        from urllib.parse import quote
        encoded_query = quote(query)
        douguo_url = f"https://www.douguo.com/caipu/{encoded_query}"
        
        logger.info(f"搜索菜谱: query={query}, page={page}")
        logger.info(f"豆果URL: {douguo_url}")
        
        # 创建session并设置cookie
        session = requests.Session()
        
        # 先访问首页获取cookie
        try:
            session.get('https://www.douguo.com/', headers=get_headers('https://www.douguo.com/', 'douguo'), timeout=5)
        except:
            pass
        
        # 再访问搜索页
        response = session.get(
            douguo_url,
            headers=get_headers('https://www.douguo.com/', 'douguo'),
            timeout=15,
            allow_redirects=True
        )
        
        response.raise_for_status()
        text_content = response.text
        
        logger.info(f"请求成功: status={response.status_code}, length={len(text_content)} 字符")
        
        return text_content, 200, {
            'Content-Type': 'text/html; charset=utf-8'
        }
        
    except requests.Timeout:
        logger.error("请求超时")
        return jsonify({'error': '请求超时，请稍后重试'}), 504
        
    except requests.RequestException as e:
        logger.error(f"请求失败: {str(e)}")
        return jsonify({'error': f'请求失败: {str(e)}'}), 500
        
    except ValueError as e:
        logger.error(f"参数错误: {str(e)}")
        return jsonify({'error': '页码参数必须是数字'}), 400
        
    except Exception as e:
        logger.error(f"未知错误: {str(e)}")
        return jsonify({'error': f'服务器错误: {str(e)}'}), 500

@app.route('/api/featured-recipes', methods=['GET'])
def featured_recipes():
    """
    获取豆果美食精选推荐菜谱
    
    返回：豆果美食首页精选菜谱的HTML
    """
    try:
        douguo_url = "https://www.douguo.com/"
        
        logger.info("获取精选推荐菜谱")
        
        session = requests.Session()
        response = session.get(
            douguo_url,
            headers=get_headers('https://www.douguo.com/', 'douguo'),
            timeout=15,
            allow_redirects=True
        )
        
        response.raise_for_status()
        text_content = response.text
        
        logger.info(f"请求成功: status={response.status_code}, length={len(text_content)} 字符")
        
        return text_content, 200, {
            'Content-Type': 'text/html; charset=utf-8'
        }
        
    except Exception as e:
        logger.error(f"获取精选菜谱失败: {str(e)}")
        return jsonify({'error': f'服务器错误: {str(e)}'}), 500

@app.route('/api/health-recipes', methods=['GET'])
def health_recipes():
    """
    获取饮食健康相关菜谱
    
    参数：
    - category: 健康分类（如：减肥、养生、补钙等），可选
    
    返回：豆果美食饮食健康页面的HTML
    """
    try:
        from urllib.parse import quote
        category = request.args.get('category', '').strip()
        
        # 分类映射 - 映射到豆果美食官方分类
        # 豆果分类来源：
        # - 饮食健康：饮食新闻 美容瘦身 饮食小常识 养生秘方
        # - 功能性调理：清热去火 减肥 祛痰 乌发 滋阴壮阳 健脾养胃
        # - 人群膳食：孕妇 老人 产妇 哺乳期
        # - 疾病调理：糖尿病 高血压 痛风
        # - 功效营养：补钙 贫血 提高免疫力 养胃 防雾霾 润肺止咳 养颜 失眠 抗癌
        category_mapping = {
            '减肥': '美容瘦身',      # 饮食健康 -> 美容瘦身（包含减肥）
            '美容': '养颜',          # 功效营养 -> 养颜
            '健脾': '健脾养胃',      # 功能性调理 -> 健脾养胃
            '补钙': '补钙',          # 功效营养 -> 补钙
            '提高免疫力': '提高免疫力',  # 功效营养 -> 提高免疫力
            '清热': '清热去火',      # 功能性调理 -> 清热去火
            '润肺': '润肺止咳',      # 功效营养 -> 润肺止咳
            '糖尿病': '糖尿病',      # 疾病调理 -> 糖尿病
            '高血压': '高血压'       # 疾病调理 -> 高血压
        }
        
        if category:
            # 使用映射后的豆果官方分类名
            mapped_category = category_mapping.get(category, category)
            encoded_category = quote(mapped_category)
            # 使用分类页面URL（不是搜索接口）
            douguo_url = f"https://www.douguo.com/caipu/{encoded_category}"
        else:
            # 默认显示精选
            douguo_url = "https://www.douguo.com/jingxuan/home"
        
        logger.info(f"获取饮食健康: category={category or '精选'}, mapped={category_mapping.get(category, category) if category else '精选'}, url={douguo_url}")
        
        session = requests.Session()
        
        # 先访问首页获取cookie
        try:
            session.get('https://www.douguo.com/', headers=get_headers('https://www.douguo.com/', 'douguo'), timeout=5)
        except:
            pass
        
        response = session.get(
            douguo_url,
            headers=get_headers('https://www.douguo.com/', 'douguo'),
            timeout=15,
            allow_redirects=True
        )
        
        response.raise_for_status()
        text_content = response.text
        
        logger.info(f"请求成功: status={response.status_code}, length={len(text_content)} 字符")
        
        return text_content, 200, {
            'Content-Type': 'text/html; charset=utf-8'
        }
        
    except Exception as e:
        logger.error(f"获取饮食健康失败: {str(e)}")
        return jsonify({'error': f'服务器错误: {str(e)}'}), 500

@app.route('/api/note-detail', methods=['GET'])
def note_detail():
    """
    获取笔记详情接口 - 支持多种来源的差异化处理
    
    参数：
    - url: 笔记详情页URL（必填）
    - debug: 是否返回调试信息（可选）
    
    返回：JSON格式的笔记详情
    """
    try:
        note_url = request.args.get('url', '').strip()
        debug_mode = request.args.get('debug', '').lower() == 'true'
        
        if not note_url:
            return jsonify({'error': '笔记URL不能为空'}), 400
        
        logger.info(f"获取笔记详情: url={note_url}, debug={debug_mode}")
        
        session = requests.Session()
        
        # 先访问百度首页获取cookie
        try:
            time.sleep(0.5)
            session.get('https://www.baidu.com/', headers=get_headers('https://www.baidu.com/', 'baidu'), timeout=10)
            time.sleep(1)
        except Exception as e:
            logger.warning(f"访问百度首页失败: {e}")
        
        # 访问详情页
        response = session.get(
            note_url,
            headers=get_headers('https://www.baidu.com/', 'baidu'),
            timeout=15,
            allow_redirects=True
        )
        
        text_content = response.text
        logger.info(f"请求完成: status={response.status_code}, length={len(text_content)} 字符")
        
        # 检测是否是百度的跳转页面
        import re
        import json
        from bs4 import BeautifulSoup
        
        real_url = None
        is_baidu_redirect = False  # 标记是否是百度跳转
        
        # 检测是否是百度的跳转页面（判断原始URL是否包含baidu.com）
        if 'baidu.com' in note_url or 'm.baidu.com' in note_url:
            is_baidu_redirect = True
        
        # 方法1: 检查 window.location.replace
        match = re.search(r'window\.location\.replace\(["\']([^"\']+)["\']\)', text_content)
        if match:
            real_url = match.group(1)
            logger.info(f"检测到JavaScript跳转: {real_url}")
        
        # 方法2: 检查 meta refresh
        if not real_url:
            match = re.search(r'<meta[^>]+http-equiv=["\']refresh["\'][^>]+content=["\'][^;]+;\s*url=([^"\']+)["\']', text_content, re.IGNORECASE)
            if match:
                real_url = match.group(1)
                logger.info(f"检测到meta refresh跳转: {real_url}")
        
        # 如果检测到跳转，重新请求真实URL
        if real_url:
            logger.info(f"跳转到真实URL: {real_url}")
            time.sleep(1)  # 延迟1秒
            
            # 根据目标域名设置合适的headers
            if 'baidu.com' in real_url or 'mbd.baidu.com' in real_url:
                real_headers = get_headers('https://www.baidu.com/', 'baidu')
            else:
                # 对于第三方网站，使用通用headers
                real_headers = {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                    'Accept-Encoding': 'gzip, deflate',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                }
            
            response = session.get(
                real_url,
                headers=real_headers,
                timeout=15,
                allow_redirects=True
            )
            
            text_content = response.text
            logger.info(f"真实页面请求完成: status={response.status_code}, length={len(text_content)} 字符, URL={real_url}")
        
        # 检查是否是错误页面
        if response.status_code >= 400:
            logger.error(f"服务器返回错误: {response.status_code}")
            return jsonify({'error': f'服务器返回错误: {response.status_code}', 'type': 'error'}), response.status_code
        
        # 根据真实URL判断来源类型并解析
        result = {
            'type': 'unknown',
            'title': '',
            'content': '',
            'images': [],
            'source': '',
            'publishTime': '',
            'rawUrl': real_url or note_url,
            'originalUrl': note_url  # 保留原始URL
        }
        
        # 如果是百度跳转到第三方网站，需要特殊处理
        if is_baidu_redirect and real_url and 'baidu.com' not in real_url:
            logger.info(f"百度跳转到第三方: {real_url}")
            
            # 对于百度跳转到第三方的情况，根据目标网站类型处理
            if 'm.dianping.com' in real_url:
                # 大众点评可以解析
                pass  # 继续下面的正常流程
            else:
                # 其他第三方网站（携程、小红书等），提示跳转
                result['type'] = 'baidu_redirect'
                result['source'] = '百度笔记'
                
                # 尝试从目标网站提取基本信息
                soup = BeautifulSoup(text_content, 'html.parser')
                title_tag = soup.find('title')
                if title_tag:
                    result['title'] = title_tag.get_text(strip=True)
                
                # 识别目标网站
                if 'ctrip.com' in real_url:
                    result['content'] = '该笔记来自携程旅行，内容丰富多样。'
                    result['source'] = '百度笔记 → 携程旅行'
                elif 'xiaohongshu.com' in real_url or 'xhslink.com' in real_url:
                    result['content'] = '该笔记来自小红书，内容精彩纷呈。'
                    result['source'] = '百度笔记 → 小红书'
                else:
                    result['content'] = '该笔记来自第三方网站。'
                    result['source'] = '百度笔记'
                
                result['needJump'] = True
                logger.info(f"百度跳转第三方，返回跳转提示: {result['source']}")
                return jsonify(result), 200
        
        # 类型1: 大众点评 - 从JSON数据中提取
        if real_url and 'm.dianping.com' in real_url:
            logger.info("检测到大众点评笔记，从JSON提取数据")
            result['type'] = 'dianping'
            
            # 提取 __NEXT_DATA__ 中的JSON数据
            match = re.search(r'<script id="__NEXT_DATA__" type="application/json"[^>]*>(.*?)</script>', text_content, re.DOTALL)
            if match:
                try:
                    data = json.loads(match.group(1))
                    feed_info = data.get('props', {}).get('pageProps', {}).get('feedInfo', {})
                    
                    result['title'] = feed_info.get('title', '')
                    result['content'] = feed_info.get('content', '')
                    
                    # 如果是从百度跳转来的，在来源中标注
                    author = feed_info.get('feedUser', {}).get('nickName', '大众点评用户')
                    if is_baidu_redirect:
                        result['source'] = f'{author} (百度笔记 → 大众点评)'
                    else:
                        result['source'] = author
                    
                    # 提取图片
                    pic_list = feed_info.get('feedPicList', [])
                    result['images'] = [pic.get('url', '') for pic in pic_list if pic.get('url')]
                    
                    logger.info(f"大众点评数据提取成功: title={result['title']}, content_length={len(result.get('content', ''))}, images={len(result['images'])}")
                except Exception as e:
                    logger.error(f"解析大众点评JSON失败: {e}")
                    result['type'] = 'parse_error'
                    result['error'] = f'解析失败: {str(e)}'
            else:
                logger.warning("未找到大众点评的JSON数据")
                result['error'] = '无法提取笔记内容'
                result['needJump'] = True
        
        # 类型2: 携程旅行 - 从JSON数据中提取
        elif real_url and 'm.ctrip.com' in real_url:
            logger.info("检测到携程旅行笔记，从JSON提取数据")
            result['type'] = 'ctrip'
            result['source'] = '携程旅行'
            
            # 携程页面的数据在 __NEXT_DATA__ 中，但结构不同
            # 这个页面主要是一个Next.js应用，内容是客户端渲染的
            # 尝试提取基本信息
            soup = BeautifulSoup(text_content, 'html.parser')
            
            # 携程的页面标题
            title_tag = soup.find('title')
            if title_tag:
                result['title'] = title_tag.string or ''
            
            # 尝试从meta标签获取描述
            desc_tag = soup.find('meta', {'name': 'description'})
            if desc_tag and desc_tag.get('content'):
                result['content'] = desc_tag.get('content')
            
            # 携程页面主要是客户端渲染，服务端HTML中内容较少
            # 建议跳转到原网站查看完整体验
            if not result['content']:
                result['content'] = '该笔记来自携程旅行，为了获得最佳体验，建议前往原网站查看。'
            result['needJump'] = True
            
        # 类型3: 百度笔记 - 尝试绕过安全验证
        elif real_url and 'mbd.baidu.com' in real_url:
            logger.info("检测到百度笔记，尝试获取内容")
            result['type'] = 'baidu'
            
            # 检查是否是安全验证页面
            if '安全验证' in text_content or 'timeout' in text_content or len(text_content) < 2000:
                logger.warning("遇到百度安全验证或内容过短")
                
                # 尝试重新请求，添加更多延迟和真实浏览器特征
                try:
                    time.sleep(2)  # 增加延迟到2秒
                    
                    # 使用更完整的浏览器headers
                    retry_headers = {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                        'Accept-Encoding': 'gzip, deflate',
                        'Connection': 'keep-alive',
                        'Upgrade-Insecure-Requests': '1',
                        'Sec-Fetch-Dest': 'document',
                        'Sec-Fetch-Mode': 'navigate',
                        'Sec-Fetch-Site': 'none',
                        'Sec-Fetch-User': '?1',
                        'Cache-Control': 'max-age=0',
                        'Referer': 'https://www.baidu.com/',
                    }
                    
                    retry_response = session.get(
                        real_url,
                        headers=retry_headers,
                        timeout=15,
                        allow_redirects=True
                    )
                    
                    if retry_response.status_code == 200:
                        text_content = retry_response.text
                        logger.info(f"重试成功，内容长度: {len(text_content)}")
                except Exception as retry_error:
                    logger.error(f"重试失败: {retry_error}")
                
                # 再次检查
                if '安全验证' in text_content or 'timeout' in text_content or len(text_content) < 2000:
                    result['type'] = 'security_check'
                    result['error'] = '该笔记需要通过百度安全验证才能查看'
                    result['needJump'] = True
                    return jsonify(result), 200
            
            # 尝试解析百度笔记内容
            soup = BeautifulSoup(text_content, 'html.parser')
            
            # 提取标题
            title_tag = soup.find('h1') or soup.find('title')
            if title_tag:
                result['title'] = title_tag.get_text(strip=True) if hasattr(title_tag, 'get_text') else title_tag.string
            
            result['source'] = '百度笔记'
            
            # 尝试提取正文内容
            content_selectors = [
                '.content-article',
                '.article-content',
                '[class*="content"]',
                'article',
                '.detail-content'
            ]
            
            for selector in content_selectors:
                content_el = soup.select_one(selector)
                if content_el:
                    paragraphs = content_el.find_all('p')
                    if paragraphs:
                        result['content'] = '\n\n'.join([p.get_text(strip=True) for p in paragraphs if p.get_text(strip=True)])
                        break
                    elif content_el.get_text(strip=True):
                        result['content'] = content_el.get_text(strip=True)
                        break
            
            # 提取图片
            images = soup.find_all('img')
            for img in images:
                src = img.get('src') or img.get('data-src') or img.get('data-original')
                if src and not any(x in src for x in ['icon', 'logo', 'avatar']):
                    # 处理相对URL
                    if src.startswith('//'):
                        src = 'https:' + src
                    elif src.startswith('/'):
                        src = 'https://mbd.baidu.com' + src
                    result['images'].append(src)
            
            # 如果提取失败，标记为需要跳转
            if not result['title'] and not result['content']:
                result['needJump'] = True
                result['error'] = '内容解析失败，建议前往原网站查看'
        
        # 未知类型 - 通用HTML解析
        else:
            logger.info("未知来源，使用通用HTML解析")
            result['type'] = 'generic'
            soup = BeautifulSoup(text_content, 'html.parser')
            
            # 尝试提取标题
            title_el = soup.find('h1') or soup.find(class_='title')
            if title_el:
                result['title'] = title_el.get_text(strip=True)
            
            # 尝试提取内容
            content_selectors = ['.content', '.article-content', 'article', '.detail-content']
            for selector in content_selectors:
                content_el = soup.select_one(selector)
                if content_el:
                    paragraphs = content_el.find_all('p')
                    result['content'] = '\n\n'.join([p.get_text(strip=True) for p in paragraphs if p.get_text(strip=True)])
                    if result['content']:
                        break
        
        # 最终结果日志
        logger.info(f"📤 返回笔记详情: type={result.get('type')}, has_title={bool(result.get('title'))}, has_content={bool(result.get('content'))}, images_count={len(result.get('images', []))}, needJump={result.get('needJump', False)}")
        
        return jsonify(result), 200
        
    except requests.Timeout:
        logger.error("请求超时")
        return jsonify({'error': '请求超时，请稍后重试', 'type': 'timeout'}), 504
        
    except requests.RequestException as e:
        logger.error(f"请求失败: {str(e)}")
        return jsonify({'error': f'请求失败: {str(e)}', 'type': 'request_error'}), 500
        
    except Exception as e:
        logger.error(f"未知错误: {str(e)}")
        return jsonify({'error': f'服务器错误: {str(e)}', 'type': 'server_error'}), 500

@app.route('/api/recipe-detail', methods=['GET'])
def recipe_detail():
    """
    获取菜谱详情接口
    
    参数：
    - url: 菜谱详情页URL（必填）
    - debug: 是否返回调试信息（可选）
    
    返回：菜谱详情的HTML
    """
    try:
        recipe_url = request.args.get('url', '').strip()
        debug_mode = request.args.get('debug', '').lower() == 'true'
        
        if not recipe_url:
            return jsonify({'error': '菜谱URL不能为空'}), 400
        
        # 确保URL是完整的
        if not recipe_url.startswith('http'):
            recipe_url = f"https://www.douguo.com{recipe_url}"
        
        logger.info(f"获取菜谱详情: url={recipe_url}, debug={debug_mode}")
        
        session = requests.Session()
        
        # 先访问首页获取cookie
        try:
            time.sleep(0.5)  # 延迟半秒
            session.get('https://www.douguo.com/', headers=get_headers('https://www.douguo.com/', 'douguo'), timeout=10)
            time.sleep(1)  # 延迟1秒，模拟真实用户
        except Exception as e:
            logger.warning(f"访问首页失败: {e}")
        
        # 访问详情页
        response = session.get(
            recipe_url,
            headers=get_headers('https://www.douguo.com/', 'douguo'),
            timeout=15,
            allow_redirects=True
        )
        
        text_content = response.text
        logger.info(f"请求完成: status={response.status_code}, length={len(text_content)} 字符")
        
        # 调试模式：在HTML中添加注释显示关键结构
        if debug_mode:
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(text_content, 'html.parser')
            
            debug_info = f"""
<!-- ===== 调试信息 ===== 
URL: {recipe_url}
状态码: {response.status_code}
内容长度: {len(text_content)}
Title: {soup.title.string if soup.title else '未找到'}

找到的主要元素:
- h1: {len(soup.find_all('h1'))} 个
- .title: {len(soup.select('.title'))} 个
- img: {len(soup.find_all('img'))} 个
- .ings li: {len(soup.select('.ings li'))} 个
- .steps li: {len(soup.select('.steps li'))} 个
- .cookstep: {len(soup.select('.cookstep'))} 个

前10个div的class:
{chr(10).join([f"  - {div.get('class', [])}" for div in soup.find_all('div', class_=True)[:10]])}
===== 调试信息结束 ===== -->
"""
            text_content = debug_info + text_content
        
        # 检查是否是错误页面
        if response.status_code >= 400:
            logger.error(f"服务器返回错误: {response.status_code}")
            return jsonify({'error': f'服务器返回错误: {response.status_code}', 'html': text_content[:500]}), response.status_code
        
        return text_content, 200, {
            'Content-Type': 'text/html; charset=utf-8'
        }
        
    except requests.Timeout:
        logger.error("请求超时")
        return jsonify({'error': '请求超时，请稍后重试'}), 504
        
    except requests.RequestException as e:
        logger.error(f"请求失败: {str(e)}")
        return jsonify({'error': f'请求失败: {str(e)}'}), 500
        
    except Exception as e:
        logger.error(f"未知错误: {str(e)}")
        return jsonify({'error': f'服务器错误: {str(e)}'}), 500

@app.errorhandler(404)
def not_found(error):
    """404错误处理"""
    return jsonify({'error': '接口不存在'}), 404

@app.errorhandler(500)
def internal_error(error):
    """500错误处理"""
    return jsonify({'error': '服务器内部错误'}), 500

# ============================================
# 数据库API - 读取本地美食数据
# ============================================

def get_db_connection():
    """获取数据库连接"""
    # 数据库文件在项目根目录
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data.db')
    
    if not os.path.exists(db_path):
        raise FileNotFoundError(f'数据库文件不存在: {db_path}')
    
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row  # 使用Row工厂，可以通过列名访问
    return conn

@app.route('/api/dishes', methods=['GET'])
def get_dishes():
    """
    获取菜品数据
    
    参数：
    - limit: 返回数量，默认1050
    - offset: 偏移量，默认0
    - shop: 店铺名称过滤（可选）
    - sort: 排序方式，默认recommendation（按推荐数），可选name（按名称）
    
    返回：菜品列表
    """
    try:
        limit = request.args.get('limit', 1050, type=int)
        offset = request.args.get('offset', 0, type=int)
        shop = request.args.get('shop', '', type=str)
        sort = request.args.get('sort', 'recommendation', type=str)
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 构建SQL查询
        sql = 'SELECT name, image_url, recommendation_count, shop_name FROM dishes'
        params = []
        
        # 店铺过滤
        if shop:
            sql += ' WHERE shop_name LIKE ?'
            params.append(f'%{shop}%')
        
        # 排序
        if sort == 'name':
            sql += ' ORDER BY name ASC'
        else:
            sql += ' ORDER BY recommendation_count DESC'
        
        # 分页
        sql += ' LIMIT ? OFFSET ?'
        params.extend([limit, offset])
        
        cursor.execute(sql, params)
        rows = cursor.fetchall()
        
        # 转换为字典列表
        dishes = []
        for row in rows:
            dishes.append({
                '菜品名称': row['name'],
                '菜品图片url': row['image_url'],
                '菜品推荐人数': row['recommendation_count'],
                '店名': row['shop_name']
            })
        
        conn.close()
        
        logger.info(f'返回菜品数据: {len(dishes)}条 (limit={limit}, offset={offset})')
        
        return jsonify({
            'success': True,
            'data': dishes,
            'count': len(dishes),
            'limit': limit,
            'offset': offset
        })
        
    except Exception as e:
        logger.error(f'获取菜品数据失败: {str(e)}')
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/shops', methods=['GET'])
def get_shops():
    """
    获取店铺数据
    
    参数：
    - limit: 返回数量，默认200
    - offset: 偏移量，默认0
    - sort: 排序方式，默认score（按评分），可选name（按名称）
    
    返回：店铺列表
    """
    try:
        limit = request.args.get('limit', 200, type=int)
        offset = request.args.get('offset', 0, type=int)
        sort = request.args.get('sort', 'score', type=str)
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 构建SQL查询
        sql = 'SELECT name, avg_price, address, phone, detail_url, score FROM shops'
        
        # 排序
        if sort == 'name':
            sql += ' ORDER BY name ASC'
        else:
            sql += ' ORDER BY score DESC NULLS LAST'
        
        # 分页
        sql += ' LIMIT ? OFFSET ?'
        
        cursor.execute(sql, [limit, offset])
        rows = cursor.fetchall()
        
        # 转换为字典列表
        shops = []
        for row in rows:
            shops.append({
                '店名': row['name'],
                '人均消费': row['avg_price'],
                '地址': row['address'],
                '电话': row['phone'],
                '详情页': row['detail_url'],
                '评分score': row['score'] if row['score'] is not None else ''
            })
        
        conn.close()
        
        logger.info(f'返回店铺数据: {len(shops)}条 (limit={limit}, offset={offset})')
        
        return jsonify({
            'success': True,
            'data': shops,
            'count': len(shops),
            'limit': limit,
            'offset': offset
        })
        
    except Exception as e:
        logger.error(f'获取店铺数据失败: {str(e)}')
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    print("=" * 60)
    print("🚀 美食笔记搜索API服务启动")
    print("=" * 60)
    print("📍 本地地址: http://localhost:5000")
    print("📍 健康检查: http://localhost:5000/api/health")
    print("📍 搜索接口: http://localhost:5000/api/search-notes?query=杭州美食推荐")
    print("📍 菜品数据: http://localhost:5000/api/dishes")
    print("📍 店铺数据: http://localhost:5000/api/shops")
    print("=" * 60)
    print("\n按 Ctrl+C 停止服务\n")
    
    # 启动Flask应用
    # debug=True: 开发模式，代码修改后自动重启
    # host='0.0.0.0': 允许外部访问
    # port=5000: 端口号
    app.run(
        debug=True,
        host='0.0.0.0',
        port=5000
    )

