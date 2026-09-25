import re

with open('app/api.py', 'r', encoding='utf-8') as f:
    content = f.read()

conflict_pattern = re.compile(r'<<<<<<< HEAD\n(.*?)=======\n(.*?)>>>>>>> origin/adarsh-backend\n', re.DOTALL)

def replace_conflict(match):
    head_content = match.group(1)
    theirs_content = match.group(2)
    # Update our analytics import to point to analytics_intelligence
    head_content = head_content.replace('from .analytics import generate_city_analytics', 'from .analytics_intelligence import generate_city_analytics')
    return head_content + '\n' + theirs_content

new_content = conflict_pattern.sub(replace_conflict, content)

with open('app/api.py', 'w', encoding='utf-8') as f:
    f.write(new_content)
